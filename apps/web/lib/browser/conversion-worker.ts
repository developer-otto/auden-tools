/// <reference lib="webworker" />
import { PDFDocument } from "pdf-lib";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  ConversionError,
  MAX_IMAGE_PIXELS,
  MAX_MEDIA_SECONDS,
  MAX_OUTPUT_BYTES,
  MAX_PAGES,
  CONVERSION_TIMEOUT_MS,
  parsePages,
  validateFiles,
  validateOptions,
  type ConversionRequest,
  type ConversionOutput,
  type WorkerResponse,
} from "../conversions";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const send = (message: WorkerResponse) => worker.postMessage(message);
const progress = (
  value: number | null,
  phase: "loading" | "converting" = "converting",
) => send({ type: "progress", progress: value, phase });
const outputName = (file: File, extension: string) =>
  `${file.name.replace(/\.[^.]+$/, "")}.${extension}`;
const pdfBlob = (bytes: Uint8Array) =>
  new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

async function readImage(file: File) {
  if (
    typeof createImageBitmap !== "function" ||
    typeof OffscreenCanvas !== "function"
  )
    throw new ConversionError("BROWSER_UNSUPPORTED");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Do not silently flatten animated PNG/WebP/AVIF inputs.
  const marker = new TextDecoder("latin1").decode(bytes);
  if (
    (marker.startsWith("\x89PNG") && marker.includes("acTL")) ||
    (marker.startsWith("RIFF") && marker.includes("ANIM")) ||
    marker.slice(4, 40).includes("avis")
  )
    throw new ConversionError("ANIMATED_IMAGE");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  if (
    bitmap.width * bitmap.height > MAX_IMAGE_PIXELS ||
    bitmap.width > 16384 ||
    bitmap.height > 16384
  ) {
    bitmap.close();
    throw new ConversionError("IMAGE_LIMIT");
  }
  return bitmap;
}

async function imageBlob(file: File, format: string, quality: number) {
  const bitmap = await readImage(file);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new ConversionError("BROWSER_UNSUPPORTED");
    if (format === "jpeg") {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality: quality / 100,
    });
    if (blob.type !== `image/${format}`)
      throw new ConversionError("BROWSER_UNSUPPORTED");
    return { blob, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function pdfConversion({
  operation,
  files,
  options,
}: ConversionRequest): Promise<ConversionOutput> {
  const output = await PDFDocument.create();
  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;
    if (operation === "images-pdf") {
      const { blob, width, height } = await imageBlob(file, "png", 100);
      const image = await output.embedPng(await blob.arrayBuffer());
      const [pageWidth, pageHeight] =
        options.paper === "fit"
          ? [width * 0.75, height * 0.75]
          : width > height
            ? [841.89, 595.28]
            : [595.28, 841.89];
      const margin = options.paper === "fit" ? 0 : 24;
      const ratio = Math.min(
        (pageWidth - margin * 2) / width,
        (pageHeight - margin * 2) / height,
      );
      const page = output.addPage([pageWidth, pageHeight]);
      page.drawImage(image, {
        x: (pageWidth - width * ratio) / 2,
        y: (pageHeight - height * ratio) / 2,
        width: width * ratio,
        height: height * ratio,
      });
    } else {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const count = source.getPageCount();
      if (!count || count > MAX_PAGES)
        throw new ConversionError("TOO_MANY_PAGES");
      const indices =
        operation === "pdf-split"
          ? parsePages(options.pages, count)
          : source.getPageIndices();
      if (output.getPageCount() + indices.length > MAX_PAGES)
        throw new ConversionError("TOO_MANY_PAGES");
      for (const page of await output.copyPages(source, indices))
        output.addPage(page);
    }
    progress(Math.round(((index + 1) / files.length) * 90));
  }
  const name =
    operation === "pdf-merge"
      ? "merged.pdf"
      : operation === "images-pdf"
        ? "images.pdf"
        : outputName(files[0]!, "pages.pdf");
  return { name, blob: pdfBlob(await output.save()) };
}

type MediaStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
};
async function mediaConversion({
  operation,
  files,
  options,
}: ConversionRequest): Promise<ConversionOutput> {
  const ffmpeg = new FFmpeg();
  let loaded = false;
  try {
    progress(null, "loading");
    const base = new URL("/conversion/", worker.location.origin).href;
    await ffmpeg.load({
      classWorkerURL: `${base}ffmpeg/worker.js`,
      coreURL: `${base}core/ffmpeg-core.js`,
      wasmURL: `${base}core/ffmpeg-core.wasm`,
    });
    loaded = true;
    progress(0);
    const input = `input.${files[0]!.name.split(".").pop()!.toLowerCase()}`;
    await ffmpeg.writeFile(
      input,
      new Uint8Array(await files[0]!.arrayBuffer()),
    );
    const probeCode = await ffmpeg.ffprobe(
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        input,
        "-o",
        "probe.json",
      ],
      30_000,
    );
    // core 0.12.10 can leave ret at -1 after a successful probe. Require a
    // readable JSON report and valid stream/duration metadata below as well.
    if (probeCode !== 0 && probeCode !== -1)
      throw new ConversionError("INVALID_FILE");
    const metadata = JSON.parse(
      (await ffmpeg.readFile("probe.json", "utf8")) as string,
    ) as { format?: { duration?: string }; streams?: MediaStream[] };
    const streams = metadata.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");
    const duration = Number(
      metadata.format?.duration ?? video?.duration ?? audio?.duration,
    );
    if (!Number.isFinite(duration) || duration <= 0)
      throw new ConversionError("INVALID_FILE");
    if (
      duration > MAX_MEDIA_SECONDS ||
      (video &&
        (Math.max(video.width ?? 0, video.height ?? 0) > 1920 ||
          Math.min(video.width ?? 0, video.height ?? 0) > 1080))
    )
      throw new ConversionError("MEDIA_LIMIT");
    if (operation === "audio-extract" && !audio)
      throw new ConversionError("NO_AUDIO");
    if (operation === "video-mp4" && !video)
      throw new ConversionError("INVALID_FILE");
    if (
      operation === "video-mp4" &&
      options.videoMode === "copy" &&
      (video?.codec_name !== "h264" || (audio && audio.codec_name !== "aac"))
    )
      throw new ConversionError("INCOMPATIBLE_CODEC");
    ffmpeg.on("progress", ({ progress: value }) =>
      progress(Math.min(99, Math.max(0, Math.round(value * 100)))),
    );
    const extension = operation === "video-mp4" ? "mp4" : options.audioFormat;
    const output = `output.${extension}`;
    const args = ["-protocol_whitelist", "file,pipe", "-i", input];
    if (operation === "video-mp4") {
      args.push("-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn");
      if (options.videoMode === "copy") args.push("-c", "copy");
      else
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "pad=ceil(iw/2)*2:ceil(ih/2)*2",
          "-threads",
          "1",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
        );
      args.push("-movflags", "+faststart");
    } else {
      args.push("-map", "0:a:0", "-vn", "-sn", "-dn");
      if (extension === "wav") args.push("-c:a", "pcm_s16le");
      else
        args.push(
          "-c:a",
          extension === "mp3" ? "libmp3lame" : "aac",
          "-b:a",
          "192k",
        );
    }
    args.push("-map_metadata", "-1", "-fs", String(MAX_OUTPUT_BYTES), output);
    const code = await ffmpeg.exec(args, CONVERSION_TIMEOUT_MS);
    if (code !== 0)
      throw new ConversionError(code === 1 ? "FAILED" : "TIMEOUT");
    const data = await ffmpeg.readFile(output);
    if (typeof data === "string") throw new ConversionError("FAILED");
    if (data.byteLength >= MAX_OUTPUT_BYTES)
      throw new ConversionError("OUTPUT_TOO_LARGE");
    const mime = {
      mp4: "video/mp4",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
    }[extension];
    return {
      name: outputName(files[0]!, extension),
      blob: new Blob([new Uint8Array(data)], { type: mime }),
    };
  } catch (error) {
    if (!loaded && !(error instanceof ConversionError))
      throw new ConversionError("ENGINE_LOAD");
    throw error;
  } finally {
    ffmpeg.terminate();
  }
}

worker.onmessage = async (event: MessageEvent<ConversionRequest>) => {
  try {
    const request = {
      ...event.data,
      options: validateOptions(event.data.options),
    };
    validateFiles(request.operation, request.files);
    progress(0);
    let result: ConversionOutput;
    if (request.operation === "image") {
      const { blob } = await imageBlob(
        request.files[0]!,
        request.options.imageFormat,
        request.options.quality,
      );
      result = {
        blob,
        name: outputName(
          request.files[0]!,
          request.options.imageFormat === "jpeg"
            ? "jpg"
            : request.options.imageFormat,
        ),
      };
    } else if (
      ["pdf-merge", "pdf-split", "images-pdf"].includes(request.operation)
    )
      result = await pdfConversion(request);
    else if (["video-mp4", "audio-extract"].includes(request.operation))
      result = await mediaConversion(request);
    else throw new ConversionError("INVALID_OPTIONS");
    if (!result.blob.size) throw new ConversionError("FAILED");
    if (result.blob.size > MAX_OUTPUT_BYTES)
      throw new ConversionError("OUTPUT_TOO_LARGE");
    send({ type: "result", ...result });
  } catch (error) {
    send({
      type: "error",
      code:
        error instanceof ConversionError
          ? error.code
          : error instanceof Error && error.name === "EncryptedPDFError"
            ? "ENCRYPTED_PDF"
            : "INVALID_FILE",
    });
  }
};
