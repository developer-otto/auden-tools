import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  ConversionError,
  parsePages,
  validateOptions,
  validateFiles,
  defaultConversionOptions,
  type ConversionId,
  type ConversionOptions,
} from "../lib/conversions.ts";
import { ConversionStore, publicJob } from "../lib/server/conversions/store.ts";
import { uploadFiles } from "../lib/server/conversions/upload.ts";
import {
  command,
  detectEngines,
  runConversion,
} from "../lib/server/conversions/engines.ts";
import { conversionConfig } from "../lib/server/conversions/config.ts";
import { session, verifyOrigin } from "../lib/server/conversions/http.ts";

const isCode = (code: string) => (error: unknown) =>
  error instanceof ConversionError && error.code === code;
const png = () =>
  sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: { r: 100, g: 150, b: 80, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
const options = defaultConversionOptions;
async function temporaryStore() {
  return new ConversionStore(await mkdtemp(join(tmpdir(), "auden-test-")));
}
async function dispose(store: ConversionStore) {
  store.close();
  await rm(store.directory, { recursive: true, force: true });
}
async function uploadRequest(files: { name: string; bytes: Uint8Array }[]) {
  const form = new FormData();
  files.forEach((file) =>
    form.append("files", new Blob([Uint8Array.from(file.bytes)]), file.name),
  );
  const request = new Request("http://localhost:3000/api/conversions", {
    method: "POST",
    body: form,
  });
  return new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: await request.arrayBuffer(),
  });
}

test("page selections preserve order, remove duplicates and reject invalid/huge ranges", () => {
  assert.deepEqual(parsePages("5,1-3,2, 4", 5), [4, 0, 1, 2, 3]);
  for (const invalid of [
    "",
    "0",
    "3-1",
    "6",
    "1-999999999999",
    "1.5",
    "1,",
    "-1",
    "Infinity",
  ])
    assert.throws(() => parsePages(invalid, 5), isCode("INVALID_PAGES"));
  assert.throws(
    () => validateOptions({ quality: 1000 }),
    isCode("INVALID_OPTIONS"),
  );
  assert.throws(
    () => validateOptions({ imageFormat: "../png" }),
    isCode("INVALID_OPTIONS"),
  );
  assert.throws(
    () => validateFiles("word-pdf", [{ name: "macro.docm", size: 10 }]),
    isCode("FILE_TYPE"),
  );
  assert.throws(
    () => validateFiles("image", [{ name: "a.png", size: 21 * 1024 * 1024 }]),
    isCode("FILE_TOO_LARGE"),
  );
});

test("streamed multipart preserves Unicode names, enforces counts and rejects truncated uploads", async () => {
  const store = await temporaryStore();
  try {
    const image = await png();
    const job = store.reserve("owner", "image", options);
    const files = await uploadFiles(
      await uploadRequest([{ name: "../../测试图片.png", bytes: image }]),
      job,
      store,
    );
    assert.equal(files[0]!.name, "测试图片.png");
    assert.equal(files[0]!.filename, "input-0.png");
    assert.deepEqual(
      await readFile(join(store.folder(job.id), files[0]!.filename)),
      image,
    );
    await store.remove(job.id);
    const countJob = store.reserve("owner", "images-pdf", options);
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      name: `${i}.png`,
      bytes: image,
    }));
    assert.equal(
      (await uploadFiles(await uploadRequest(twenty), countJob, store)).length,
      20,
    );
    await store.remove(countJob.id);
    const excess = store.reserve("owner", "image", options);
    await assert.rejects(
      uploadFiles(await uploadRequest(twenty.slice(0, 2)), excess, store),
      isCode("FILE_COUNT"),
    );
    await store.remove(excess.id);
    const broken = store.reserve("owner", "image", options);
    await assert.rejects(
      uploadFiles(
        new Request("http://localhost:3000", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=abc" },
          body: '--abc\r\nContent-Disposition: form-data; name="files"; filename="a.png"\r\n\r\ntruncated',
        }),
        broken,
        store,
      ),
      isCode("UPLOAD_FAILED"),
    );
    await store.remove(broken.id);
    const boundary = store.reserve("owner", "image", options);
    const exactLimit = Buffer.alloc(20 * 1024 * 1024, 1);
    assert.equal(
      (
        await uploadFiles(
          await uploadRequest([{ name: "limit.png", bytes: exactLimit }]),
          boundary,
          store,
        )
      )[0]!.size,
      exactLimit.length,
    );
    await store.remove(boundary.id);
    const nameless = store.reserve("owner", "image", options);
    await assert.rejects(
      uploadFiles(
        new Request("http://localhost:3000", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=abc" },
          body: '--abc\r\nContent-Disposition: form-data; name="files"\r\nContent-Type: application/octet-stream\r\n\r\ndata\r\n--abc--\r\n',
        }),
        nameless,
        store,
      ),
      isCode("FILE_TYPE"),
    );
  } finally {
    await dispose(store);
  }
});

test("queue claims are exclusive across connections, access is owner-bound and expiry removes disk files", async () => {
  const store = await temporaryStore(),
    second = new ConversionStore(store.directory);
  try {
    const job = store.reserve("alice", "image", options);
    await mkdir(store.folder(job.id));
    await writeFile(join(store.folder(job.id), "input.png"), "test");
    store.enqueue(job.id, [
      { name: "original.png", filename: "input.png", size: 4 },
    ]);
    assert.throws(() => store.owned(job.id, "bob"), isCode("NOT_FOUND"));
    assert.throws(() => store.folder("../outside"), isCode("NOT_FOUND"));
    assert.equal(second.claim("worker")?.id, job.id);
    assert.equal(store.claim("another"), null);
    assert.ok(!("owner" in publicJob(store.get(job.id)!)));
    assert.ok(!("filename" in publicJob(store.get(job.id)!).inputs[0]!));
    store.cancel(job.id, "alice");
    store.finish(job.id, null);
    assert.equal(store.get(job.id)?.status, "cancelled");
    store.cancel(job.id, "alice");
    await store.cleanup();
    assert.equal(store.get(job.id), null);
    await assert.rejects(stat(store.folder(job.id)));
    store.heartbeat("worker", { office: true, ffmpeg: true });
    assert.equal(store.capabilities().office, true);
    store.stopWorker("worker");
    assert.equal(store.capabilities().online, false);
  } finally {
    second.close();
    await dispose(store);
  }
});

test("session credentials are HttpOnly, opaque and same-origin writes are required", () => {
  const request = new Request("https://tools.example/api/conversions", {
    headers: { origin: "https://tools.example" },
  });
  const auth = session(request, true);
  assert.match(auth.cookie!, /HttpOnly; SameSite=Strict/);
  assert.match(auth.cookie!, /Secure/);
  assert.equal(auth.owner?.length, 64);
  assert.equal(
    session(
      new Request(request, {
        headers: { cookie: auth.cookie!.split(";")[0]! },
      }),
    ).owner,
    auth.owner,
  );
  assert.doesNotThrow(() => verifyOrigin(request));
  assert.throws(
    () =>
      verifyOrigin(
        new Request(request, { headers: { origin: "https://other.example" } }),
      ),
    isCode("FORBIDDEN"),
  );
});

test("real image and PDF engines retain dimensions, transparency, page order and selection", async () => {
  const store = await temporaryStore();
  async function convert(
    operation: ConversionId,
    files: { name: string; bytes: Uint8Array }[],
    settings: Partial<ConversionOptions> = {},
  ) {
    const job = store.reserve("owner", operation, { ...options, ...settings });
    store.enqueue(
      job.id,
      await uploadFiles(await uploadRequest(files), job, store),
    );
    const claimed = store.claim("test")!;
    const result = await runConversion(
      claimed,
      store.folder(job.id),
      (percent) => store.progress(job.id, percent),
    );
    store.finish(job.id, result);
    await store.compact(job.id);
    const bytes = await readFile(join(store.folder(job.id), result.filename));
    assert.equal(result.size, bytes.length);
    return bytes;
  }
  try {
    const image = await png();
    for (const format of ["webp", "jpeg", "png", "avif"] as const) {
      const converted = await convert(
        "image",
        [{ name: "图.png", bytes: image }],
        { imageFormat: format },
      );
      const meta = await sharp(converted).metadata();
      assert.equal(meta.width, 120);
      assert.equal(meta.height, 80);
      assert.equal(meta.hasAlpha, format !== "jpeg");
      assert.equal(meta.format, format === "avif" ? "heif" : format);
    }
    const first = await PDFDocument.create();
    first.addPage([100, 200]);
    first.addPage([200, 300]);
    const second = await PDFDocument.create();
    second.addPage([300, 400]);
    const merged = await convert("pdf-merge", [
      { name: "a.pdf", bytes: await first.save() },
      { name: "b.pdf", bytes: await second.save() },
    ]);
    assert.deepEqual(
      (await PDFDocument.load(merged))
        .getPages()
        .map((page) => page.getWidth()),
      [100, 200, 300],
    );
    const split = await convert(
      "pdf-split",
      [{ name: "merged.pdf", bytes: merged }],
      { pages: "3,1,3" },
    );
    assert.deepEqual(
      (await PDFDocument.load(split)).getPages().map((page) => page.getWidth()),
      [300, 100],
    );
    const album = await convert("images-pdf", [
      { name: "1.png", bytes: image },
      { name: "2.png", bytes: image },
    ]);
    const albumPdf = await PDFDocument.load(album);
    assert.equal(albumPdf.getPageCount(), 2);
    assert.equal(albumPdf.getPage(0).getWidth(), 841.89);
    const bad = store.reserve("bad", "image", options);
    await mkdir(store.folder(bad.id));
    await writeFile(join(store.folder(bad.id), "input.png"), "not an image");
    await assert.rejects(
      runConversion(
        {
          ...bad,
          inputs: [{ name: "fake.png", filename: "input.png", size: 12 }],
        },
        store.folder(bad.id),
        () => {},
      ),
    );
  } finally {
    await dispose(store);
  }
});

test(
  "independent worker processes real MOV, audio and Word jobs and persists downloadable results",
  { timeout: 60000 },
  async (t) => {
    const capabilities = await detectEngines();
    const store = await temporaryStore();
    const child = spawn(process.execPath, ["scripts/conversion-worker.ts"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, CONVERSION_DATA_DIR: store.directory },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let diagnostics = "";
    child.stdout.on("data", (data) => {
      diagnostics += String(data);
    });
    child.stderr.on("data", (data) => {
      diagnostics += String(data);
    });
    async function waitFor<T>(
      read: () => T | null | false,
      timeout = 30000,
    ): Promise<T> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const value = read();
        if (value) return value;
        await delay(100);
      }
      throw new Error(`Worker timeout: ${diagnostics}`);
    }
    async function queue(
      operation: ConversionId,
      name: string,
      bytes: Uint8Array,
      settings: Partial<ConversionOptions> = {},
    ) {
      const job = store.reserve("owner", operation, {
        ...options,
        ...settings,
      });
      store.enqueue(
        job.id,
        await uploadFiles(await uploadRequest([{ name, bytes }]), job, store),
      );
      const completed = await waitFor(() => {
        const current = store.get(job.id)!;
        return ["succeeded", "failed"].includes(current.status)
          ? current
          : null;
      });
      assert.equal(
        completed.status,
        "succeeded",
        `${operation}: ${completed.error}`,
      );
      const result = await readFile(
        join(store.folder(job.id), completed.output!.filename),
      );
      return { result, job: completed };
    }
    try {
      await waitFor(() => store.capabilities().online);
      const image = await queue("image", "input.png", await png());
      assert.equal((await sharp(image.result).metadata()).format, "webp");
      await t.test(
        "MOV to MP4 and MP3/WAV/M4A audio",
        { skip: !capabilities.ffmpeg },
        async () => {
          const sample = join(store.directory, "sample.mov"),
            config = conversionConfig();
          await command(config.ffmpeg, [
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=green:s=320x240:r=24",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=44100",
            "-t",
            "1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            sample,
          ]);
          const video = await readFile(sample);
          for (const videoMode of ["compatible", "copy"] as const) {
            const { result, job } = await queue(
              "video-mp4",
              "sample.mov",
              video,
              { videoMode },
            );
            assert.equal(result.toString("ascii", 4, 8), "ftyp");
            const probe = JSON.parse(
              await command(config.ffprobe, [
                "-v",
                "error",
                "-show_streams",
                "-of",
                "json",
                join(store.folder(job.id), job.output!.filename),
              ]),
            );
            assert.equal(probe.streams[0].codec_name, "h264");
            assert.equal(probe.streams[1].codec_name, "aac");
          }
          for (const audioFormat of ["mp3", "wav", "m4a"] as const) {
            const { job } = await queue("audio-extract", "sample.mov", video, {
              audioFormat,
            });
            const probe = JSON.parse(
              await command(config.ffprobe, [
                "-v",
                "error",
                "-show_streams",
                "-of",
                "json",
                join(store.folder(job.id), job.output!.filename),
              ]),
            );
            assert.equal(probe.streams.length, 1);
            assert.equal(probe.streams[0].codec_type, "audio");
            assert.equal(
              probe.streams[0].codec_name,
              { mp3: "mp3", wav: "pcm_s16le", m4a: "aac" }[audioFormat],
            );
          }
        },
      );
      await t.test("DOCX to PDF", { skip: !capabilities.office }, async () => {
        const docx = await readFile(
          new URL("./fixtures/letter.docx", import.meta.url),
        );
        const converted = await queue("word-pdf", "letter.docx", docx);
        assert.equal(
          (await PDFDocument.load(converted.result)).getPageCount(),
          1,
        );
      });
    } finally {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once("close", () => resolve());
      });
      await dispose(store);
    }
  },
);
