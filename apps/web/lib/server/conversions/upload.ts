import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  ConversionError,
  conversionSpecs,
  validateFiles,
  type InputFile,
} from "../../conversions.ts";
import { UPLOAD_TIMEOUT_MS } from "./config.ts";
import type { ConversionStore, StoredJob } from "./store.ts";

export async function uploadFiles(
  request: Request,
  job: StoredJob,
  store: ConversionStore,
): Promise<InputFile[]> {
  const spec = conversionSpecs[job.operation];
  if (
    !request.body ||
    !request.headers.get("content-type")?.startsWith("multipart/form-data;")
  )
    throw new ConversionError("FILE_TYPE");
  if (
    Number(request.headers.get("content-length")) >
    spec.maxTotalBytes + 65536
  )
    throw new ConversionError("FILE_TOO_LARGE");
  const folder = store.folder(job.id);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const files: InputFile[] = [],
    writes: Promise<void>[] = [];
  const controller = new AbortController(),
    timeout = AbortSignal.timeout(UPLOAD_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout, controller.signal]);
  const state: { error: Error | null } = { error: null };
  let bytes = 0;
  const fail = (cause: Error) => {
    state.error ??= cause;
    // Do not destroy Busboy reentrantly from inside its parser callback.
    queueMicrotask(() => controller.abort());
  };
  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: { "content-type": request.headers.get("content-type")! },
      defParamCharset: "utf8",
      limits: {
        fileSize: spec.maxFileBytes + 1,
        files: spec.maxFiles,
        fields: 0,
        parts: spec.maxFiles + 1,
        headerPairs: 100,
      },
    });
  } catch {
    throw new ConversionError("FILE_TYPE");
  }
  parser.on("file", (field, stream, info) => {
    if (typeof info.filename !== "string") {
      stream.resume();
      fail(new ConversionError("FILE_TYPE"));
      return;
    }
    const name = Array.from(
      basename(info.filename.replaceAll("\\", "/")).replace(
        /[\p{Cc}\p{Cf}]/gu,
        "",
      ),
    )
      .slice(0, 180)
      .join("");
    const extension = name.split(".").pop()!.toLowerCase();
    if (field !== "files" || !spec.extensions.includes(extension)) {
      stream.resume();
      fail(new ConversionError("FILE_TYPE"));
      return;
    }
    const file: InputFile = {
      name,
      filename: `input-${files.length}.${extension}`,
      size: 0,
    };
    files.push(file);
    stream.on("limit", () => fail(new ConversionError("FILE_TOO_LARGE")));
    stream.on("data", (chunk: Buffer) => {
      file.size += chunk.length;
    });
    const write = pipeline(
      stream,
      createWriteStream(join(folder, file.filename), {
        flags: "wx",
        mode: 0o600,
      }),
      { signal },
    ).catch((cause) => {
      fail(cause);
    });
    writes.push(write);
  });
  parser.on("filesLimit", () => fail(new ConversionError("FILE_COUNT")));
  parser.on("fieldsLimit", () => fail(new ConversionError("INVALID_OPTIONS")));
  parser.on("partsLimit", () => fail(new ConversionError("FILE_COUNT")));
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(
        bytes > spec.maxTotalBytes + 65536
          ? new ConversionError("FILE_TOO_LARGE")
          : null,
        chunk,
      );
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>),
      meter,
      parser,
      { signal },
    );
    await Promise.all(writes);
    if (state.error) throw state.error;
    validateFiles(job.operation, files);
    return files;
  } catch (cause) {
    controller.abort();
    await Promise.all(writes);
    if (state.error instanceof ConversionError) throw state.error;
    if (cause instanceof ConversionError) throw cause;
    throw new ConversionError(
      timeout.aborted ? "UPLOAD_TIMEOUT" : "UPLOAD_FAILED",
    );
  }
}
