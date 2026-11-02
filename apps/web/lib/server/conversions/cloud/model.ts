import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import {
  ConversionError,
  RETENTION_MS,
  publicJob,
  validateFiles,
  validateOptions,
  isConversionId,
  type ConversionId,
  type ConversionJob,
  type ConversionOptions,
  type InputFile,
  type OutputFile,
} from "../../../conversions.ts";
import {
  MAX_OUTPUT_BYTES,
  UPLOAD_TIMEOUT_MS,
  JOB_TIMEOUT_MS,
} from "../config.ts";

export type CloudInput = InputFile & { pathname: string };
export type CloudOutput = OutputFile & { pathname: string };
export type CloudJob = Omit<ConversionJob, "inputs" | "output"> & {
  owner: string;
  options: ConversionOptions;
  inputs: CloudInput[];
  output: CloudOutput | null;
  updatedAt: number;
  uploadDeadline: number;
  startedAt: number | null;
  reservedBytes: number;
  runId: string | null;
  sandboxName: string;
  hidden: boolean;
};
export { publicJob };

export function cleanupDeadline(job: CloudJob) {
  return Math.max(
    job.expiresAt,
    job.uploadDeadline + 60000,
    job.hidden ? job.updatedAt + JOB_TIMEOUT_MS + 60000 : 0,
  );
}

export function jobPrefix(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id,
    )
  )
    throw new ConversionError("NOT_FOUND");
  return `conversions/${id}/`;
}

export function parseManifest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConversionError("INVALID_OPTIONS");
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.operation !== "string" ||
    !isConversionId(raw.operation) ||
    !Array.isArray(raw.files)
  )
    throw new ConversionError("INVALID_OPTIONS");
  const files = raw.files.map((file: unknown) => {
    if (
      !file ||
      typeof file !== "object" ||
      !("name" in file) ||
      !("size" in file) ||
      typeof file.name !== "string" ||
      typeof file.size !== "number"
    )
      throw new ConversionError("FILE_TYPE");
    return { name: file.name, size: file.size };
  });
  validateFiles(raw.operation, files);
  return {
    operation: raw.operation,
    options: validateOptions(raw.options),
    files,
  };
}

export function createCloudJob(
  owner: string,
  operation: ConversionId,
  options: ConversionOptions,
  files: { name: string; size: number }[],
  now = Date.now(),
): CloudJob {
  validateFiles(operation, files);
  const id = randomUUID();
  const inputs = files.map((file, index) => {
    const name = Array.from(
      basename(file.name.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, ""),
    )
      .slice(0, 180)
      .join("");
    const filename = `input-${index}.${file.name.split(".").pop()!.toLowerCase()}`;
    return {
      name,
      size: file.size,
      filename,
      pathname: `${jobPrefix(id)}${filename}`,
    };
  });
  return {
    id,
    owner,
    operation,
    options: validateOptions(options),
    inputs,
    output: null,
    status: "uploading",
    progress: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + RETENTION_MS,
    uploadDeadline: now + UPLOAD_TIMEOUT_MS,
    startedAt: null,
    reservedBytes:
      inputs.reduce((sum, file) => sum + file.size, 0) + MAX_OUTPUT_BYTES,
    runId: null,
    sandboxName: `auden-${id}`,
    hidden: false,
  };
}

export function expectedOutput(
  job: Pick<CloudJob, "id" | "operation" | "options" | "inputs">,
) {
  const extension =
    job.operation === "image"
      ? job.options.imageFormat === "jpeg"
        ? "jpg"
        : job.options.imageFormat
      : job.operation === "video-mp4"
        ? "mp4"
        : job.operation === "audio-extract"
          ? job.options.audioFormat
          : "pdf";
  const mime =
    job.operation === "image"
      ? `image/${job.options.imageFormat}`
      : extension === "mp4"
        ? "video/mp4"
        : extension === "mp3"
          ? "audio/mpeg"
          : extension === "m4a"
            ? "audio/mp4"
            : extension === "wav"
              ? "audio/wav"
              : "application/pdf";
  const stem =
    job.operation === "pdf-merge"
      ? "merged"
      : job.operation === "images-pdf"
        ? "images"
        : job.inputs[0]!.name.replace(/\.[^.]+$/, "");
  const filename = `result.${extension}`;
  return {
    filename,
    mime,
    name: `${stem}${job.operation === "pdf-split" ? "-pages" : ""}.${extension}`,
    pathname: `${jobPrefix(job.id)}${filename}`,
  };
}

export function uploadGrant(
  job: CloudJob,
  pathname: string,
  owner: string | null,
  now = Date.now(),
) {
  if (
    !owner ||
    owner !== job.owner ||
    job.hidden ||
    job.status !== "uploading" ||
    now >= job.uploadDeadline
  )
    throw new ConversionError("NOT_FOUND");
  const input = job.inputs.find((file) => file.pathname === pathname);
  if (!input) throw new ConversionError("FORBIDDEN");
  return {
    maximumSizeInBytes: input.size,
    validUntil: job.uploadDeadline,
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 60,
    tokenPayload: job.id,
  };
}
