import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ConversionError,
  MAX_MEDIA_SECONDS,
  MAX_PAGES,
  parsePages,
  type OutputFile,
  type InputFile,
  type ConversionId,
  type ConversionOptions,
} from "../../conversions.ts";
import { conversionConfig, MAX_OUTPUT_BYTES } from "./config.ts";

export type EngineJob = {
  operation: ConversionId;
  options: ConversionOptions;
  inputs: InputFile[];
};

type Progress = (percent: number) => void;
const pixelLimit = 40_000_000;
sharp.concurrency(1);
sharp.cache(false);

// Commands and argument lists are controlled by the application; no shell is used.
export function command(
  executable: string,
  args: string[],
  onOutput?: (text: string) => void,
  timeout = 600_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OMP_NUM_THREADS: "1" },
    });
    let stdout = "",
      stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ConversionError("TIMEOUT"));
    }, timeout);
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout = (stdout + text).slice(-1_000_000);
      onOutput?.(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new ConversionError("ENGINE_UNAVAILABLE"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new ConversionError(
            /password|encrypted/i.test(stderr)
              ? "ENCRYPTED_PDF"
              : "INVALID_FILE",
          ),
        );
    });
  });
}

async function raster(path: string) {
  const input = sharp(path, { limitInputPixels: pixelLimit, failOn: "error" });
  const metadata = await input.metadata();
  if (!["jpeg", "png", "webp", "heif", "avif"].includes(metadata.format || ""))
    throw new ConversionError("FILE_TYPE");
  if ((metadata.pages || 1) > 1) throw new ConversionError("ANIMATED_IMAGE");
  return input.rotate();
}
async function pdf(path: string) {
  try {
    const bytes = await readFile(path);
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")))
      throw new ConversionError("INVALID_FILE");
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.getPageCount() < 1 || doc.getPageCount() > MAX_PAGES)
      throw new ConversionError("TOO_MANY_PAGES");
    return doc;
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    if (error instanceof Error && /encrypted/i.test(error.message))
      throw new ConversionError("ENCRYPTED_PDF");
    throw new ConversionError("INVALID_FILE");
  }
}
type MediaInfo = {
  format?: { duration?: string; format_name?: string };
  streams: {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    duration?: string;
  }[];
};
async function probe(path: string): Promise<MediaInfo> {
  const text = await command(
    conversionConfig().ffprobe,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "mov,matroska,webm",
      "-show_entries",
      "format=duration,format_name:stream=codec_type,codec_name,width,height,duration",
      "-of",
      "json",
      path,
    ],
    undefined,
    20_000,
  );
  try {
    return JSON.parse(text) as MediaInfo;
  } catch {
    throw new ConversionError("INVALID_FILE");
  }
}

export async function runConversion(
  job: EngineJob,
  folder: string,
  progress: Progress,
): Promise<OutputFile> {
  const inputs = job.inputs.map((file) => join(folder, file.filename)),
    options = job.options;
  let extension = "pdf",
    mime = "application/pdf";
  if (job.operation === "image") {
    extension = options.imageFormat === "jpeg" ? "jpg" : options.imageFormat;
    mime = `image/${options.imageFormat}`;
  }
  if (job.operation === "video-mp4") {
    extension = "mp4";
    mime = "video/mp4";
  }
  if (job.operation === "audio-extract") {
    extension = options.audioFormat;
    mime = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" }[
      extension as typeof options.audioFormat
    ];
  }
  const filename = `result.${extension}`,
    output = join(folder, filename);
  if (job.operation === "image") {
    const image = await raster(inputs[0]!);
    if (options.imageFormat === "jpeg")
      image.flatten({ background: "#ffffff" });
    await image
      .toFormat(options.imageFormat, {
        quality: options.quality,
        effort: options.imageFormat === "avif" ? 4 : undefined,
      })
      .toFile(output);
  } else if (job.operation === "pdf-merge" || job.operation === "pdf-split") {
    const merged = await PDFDocument.create();
    for (let index = 0; index < inputs.length; index++) {
      const source = await pdf(inputs[index]!);
      const indices =
        job.operation === "pdf-split"
          ? parsePages(options.pages, source.getPageCount())
          : source.getPageIndices();
      if (merged.getPageCount() + indices.length > MAX_PAGES)
        throw new ConversionError("TOO_MANY_PAGES");
      const pages = await merged.copyPages(source, indices);
      pages.forEach((page) => merged.addPage(page));
      progress(((index + 1) / inputs.length) * 90);
    }
    await writeFile(output, await merged.save());
  } else if (job.operation === "images-pdf") {
    const document = await PDFDocument.create();
    for (let index = 0; index < inputs.length; index++) {
      const image = await document.embedPng(
        await (await raster(inputs[index]!)).png().toBuffer(),
      );
      const [width, height] =
        options.paper === "fit"
          ? [image.width * 0.75, image.height * 0.75]
          : image.width > image.height
            ? [841.89, 595.28]
            : [595.28, 841.89];
      const margin = options.paper === "fit" ? 0 : 24;
      const scale = Math.min(
        (width! - margin * 2) / image.width,
        (height! - margin * 2) / image.height,
      );
      const page = document.addPage([width!, height!]);
      page.drawImage(image, {
        x: (width! - image.width * scale) / 2,
        y: (height! - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
      progress(((index + 1) / inputs.length) * 90);
    }
    await writeFile(output, await document.save());
  } else if (job.operation === "word-pdf") {
    const source = inputs[0]!,
      header = (await readFile(source)).subarray(0, 8);
    if (
      source.endsWith(".docx")
        ? !header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        : !header.equals(
            Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
          )
    )
      throw new ConversionError("INVALID_FILE");
    const profile = join(folder, "office-profile"),
      converted = join(folder, "office-output");
    await mkdir(join(profile, "user"), { recursive: true });
    await mkdir(converted);
    await writeFile(
      join(profile, "user", "registrymodifications.xcu"),
      '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>',
    );
    await command(conversionConfig().office, [
      `-env:UserInstallation=${pathToFileURL(profile).href}`,
      "--headless",
      "--norestore",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "pdf:writer_pdf_Export",
      "--outdir",
      converted,
      source,
    ]);
    const result = join(converted, `${basename(source, extname(source))}.pdf`);
    // LibreOffice can exit successfully without writing a file (e.g. bad input).
    await pdf(result);
    const { rename } = await import("node:fs/promises");
    await rename(result, output);
  } else {
    const source = inputs[0]!,
      info = await probe(source);
    const duration = Number(info.format?.duration),
      video = info.streams.find((stream) => stream.codec_type === "video"),
      audio = info.streams.find((stream) => stream.codec_type === "audio");
    if (!Number.isFinite(duration) || duration <= 0)
      throw new ConversionError("INVALID_FILE");
    if (
      duration > MAX_MEDIA_SECONDS ||
      (video && (video.width || 0) * (video.height || 0) > 4096 * 2160)
    )
      throw new ConversionError("MEDIA_LIMIT");
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "mov,matroska,webm",
      "-threads",
      "2",
      "-i",
      source,
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
    ];
    if (job.operation === "video-mp4") {
      if (!video) throw new ConversionError("INVALID_FILE");
      args.push("-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn");
      if (options.videoMode === "copy") {
        if (
          video.codec_name !== "h264" ||
          (audio && audio.codec_name !== "aac")
        )
          throw new ConversionError("INCOMPATIBLE_CODEC");
        args.push("-c", "copy");
      } else
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "pad=ceil(iw/2)*2:ceil(ih/2)*2",
          "-threads",
          "2",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
        );
      args.push("-movflags", "+faststart");
    } else {
      if (!audio) throw new ConversionError("NO_AUDIO");
      args.push("-map", "0:a:0", "-vn", "-sn", "-dn");
      if (options.audioFormat === "mp3")
        args.push("-c:a", "libmp3lame", "-b:a", "192k");
      if (options.audioFormat === "m4a")
        args.push("-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart");
      if (options.audioFormat === "wav") args.push("-c:a", "pcm_s16le");
    }
    args.push(
      "-fs",
      String(MAX_OUTPUT_BYTES + 1),
      "-progress",
      "pipe:1",
      "-nostats",
      output,
    );
    let pending = "";
    await command(conversionConfig().ffmpeg, args, (text) => {
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        const match = line.match(/^out_time_us=(\d+)/);
        if (match) progress((Number(match[1]) / 1_000_000 / duration) * 100);
      }
    });
  }
  const size = (await stat(output)).size;
  if (!size) throw new ConversionError("INVALID_FILE");
  if (size >= MAX_OUTPUT_BYTES) throw new ConversionError("OUTPUT_TOO_LARGE");
  const stem =
    job.operation === "pdf-merge"
      ? "merged"
      : job.operation === "images-pdf"
        ? "images"
        : basename(job.inputs[0]!.name, extname(job.inputs[0]!.name));
  return {
    name: `${stem}${job.operation === "pdf-split" ? "-pages" : ""}.${extension}`,
    filename,
    mime,
    size,
  };
}

export async function detectEngines() {
  const config = conversionConfig();
  const results = await Promise.allSettled([
    command(config.ffmpeg, ["-version"], undefined, 10000),
    command(config.ffprobe, ["-version"], undefined, 10000),
    command(config.office, ["--headless", "--version"], undefined, 10000),
  ]);
  return {
    ffmpeg:
      results[0].status === "fulfilled" && results[1].status === "fulfilled",
    office: results[2].status === "fulfilled",
  };
}
