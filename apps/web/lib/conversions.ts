// Browser conversion limits, validation and worker protocol. No server dependencies.
export const conversionIds = [
  "image",
  "pdf-merge",
  "pdf-split",
  "images-pdf",
  "word-pdf",
  "video-mp4",
  "audio-extract",
] as const;
export type ConversionId = (typeof conversionIds)[number];
const imageExtensions = ["jpg", "jpeg", "png", "webp", "avif"];
const videoExtensions = ["mov", "mp4", "mkv", "webm", "m4v"];
const MB = 1024 * 1024;
export const conversionSpecs: Record<
  ConversionId,
  {
    extensions: string[];
    minFiles: number;
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    engine: "built-in" | "office" | "ffmpeg";
  }
> = {
  image: {
    extensions: imageExtensions,
    minFiles: 1,
    maxFiles: 1,
    maxFileBytes: 20 * MB,
    maxTotalBytes: 20 * MB,
    engine: "built-in",
  },
  "pdf-merge": {
    extensions: ["pdf"],
    minFiles: 2,
    maxFiles: 20,
    maxFileBytes: 20 * MB,
    maxTotalBytes: 50 * MB,
    engine: "built-in",
  },
  "pdf-split": {
    extensions: ["pdf"],
    minFiles: 1,
    maxFiles: 1,
    maxFileBytes: 20 * MB,
    maxTotalBytes: 20 * MB,
    engine: "built-in",
  },
  "images-pdf": {
    extensions: imageExtensions,
    minFiles: 1,
    maxFiles: 20,
    maxFileBytes: 20 * MB,
    maxTotalBytes: 50 * MB,
    engine: "built-in",
  },
  "word-pdf": {
    extensions: ["docx"],
    minFiles: 1,
    maxFiles: 1,
    maxFileBytes: 20 * MB,
    maxTotalBytes: 20 * MB,
    engine: "office",
  },
  "video-mp4": {
    extensions: videoExtensions,
    minFiles: 1,
    maxFiles: 1,
    maxFileBytes: 100 * MB,
    maxTotalBytes: 100 * MB,
    engine: "ffmpeg",
  },
  "audio-extract": {
    extensions: videoExtensions,
    minFiles: 1,
    maxFiles: 1,
    maxFileBytes: 100 * MB,
    maxTotalBytes: 100 * MB,
    engine: "ffmpeg",
  },
};
export const MAX_PAGES = 500;
export const MAX_MEDIA_SECONDS = 300;
export const MAX_OUTPUT_BYTES = 128 * MB;
export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_WORD_PAGES = 30;
export const CONVERSION_TIMEOUT_MS = 10 * 60 * 1000;
export type ConversionOptions = {
  imageFormat: "png" | "jpeg" | "webp";
  quality: number;
  pages: string;
  paper: "a4" | "fit";
  videoMode: "compatible" | "copy";
  audioFormat: "mp3" | "wav" | "m4a";
};
export const defaultConversionOptions: ConversionOptions = {
  imageFormat: "webp",
  quality: 85,
  pages: "",
  paper: "a4",
  videoMode: "compatible",
  audioFormat: "mp3",
};
export type JobStatus = "running" | "succeeded" | "failed" | "cancelled";
export type ConversionOutput = { name: string; blob: Blob };
export type ConversionRequest = {
  operation: ConversionId;
  files: File[];
  options: ConversionOptions;
};
export type ConversionProgress = {
  progress: number | null;
  phase: "loading" | "converting";
};
export type WorkerResponse =
  | ({ type: "progress" } & ConversionProgress)
  | ({ type: "result" } & ConversionOutput)
  | { type: "error"; code: string };
export type ConversionJob = {
  id: string;
  operation: ConversionId;
  status: JobStatus;
  createdAt: number;
  progress: number | null;
  phase: ConversionProgress["phase"];
  error: string | null;
  inputs: { name: string; size: number }[];
  output: { name: string; size: number; url: string } | null;
};
export const isConversionId = (value: string): value is ConversionId =>
  conversionIds.some((id) => id === value);
export const isActiveJob = (job: Pick<ConversionJob, "status">) =>
  job.status === "running";

export class ConversionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ConversionError";
    this.code = code;
  }
}

export function validateOptions(value: unknown): ConversionOptions {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConversionError("INVALID_OPTIONS");
  const options = { ...defaultConversionOptions, ...value };
  if (
    !["png", "jpeg", "webp"].includes(options.imageFormat) ||
    !Number.isInteger(options.quality) ||
    options.quality < 10 ||
    options.quality > 100 ||
    !["a4", "fit"].includes(options.paper) ||
    !["compatible", "copy"].includes(options.videoMode) ||
    !["mp3", "wav", "m4a"].includes(options.audioFormat) ||
    typeof options.pages !== "string" ||
    options.pages.length > 2000
  )
    throw new ConversionError("INVALID_OPTIONS");
  // Only keep supported options.
  return {
    imageFormat: options.imageFormat,
    quality: options.quality,
    pages: options.pages.trim(),
    paper: options.paper,
    videoMode: options.videoMode,
    audioFormat: options.audioFormat,
  };
}

export function parsePages(value: string, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PAGES)
    throw new ConversionError("TOO_MANY_PAGES");
  if (!value.trim()) throw new ConversionError("INVALID_PAGES");
  const pages = new Set<number>();
  for (const part of value.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new ConversionError("INVALID_PAGES");
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count)
      throw new ConversionError("INVALID_PAGES");
    for (let page = start; page <= end; page++) pages.add(page - 1);
  }
  return [...pages];
}

export function validateFiles(
  operation: ConversionId,
  files: { name: string; size: number }[],
) {
  const spec = conversionSpecs[operation];
  if (files.length < spec.minFiles || files.length > spec.maxFiles)
    throw new ConversionError("FILE_COUNT");
  if (
    files.some(
      (file) =>
        !Number.isSafeInteger(file.size) ||
        file.size <= 0 ||
        typeof file.name !== "string" ||
        !file.name ||
        file.name.length > 512 ||
        !spec.extensions.includes(file.name.split(".").pop()!.toLowerCase()),
    )
  )
    throw new ConversionError("FILE_TYPE");
  if (
    files.some((file) => file.size > spec.maxFileBytes) ||
    files.reduce((sum, file) => sum + file.size, 0) > spec.maxTotalBytes
  )
    throw new ConversionError("FILE_TOO_LARGE");
}

export const conversionErrors: Record<string, string> = {
  INVALID_OPTIONS: "转换选项无效，请重新设置。",
  INVALID_PAGES: "页码无效，请输入 PDF 中存在的页码，例如 1-3,5。",
  TOO_MANY_PAGES: "PDF 总页数不能超过 500 页。",
  FILE_COUNT: "文件数量不符合要求。",
  FILE_TYPE: "文件格式不受支持，或文件为空。",
  FILE_TOO_LARGE: "文件超过大小限制，请选择较小的文件。",
  INVALID_FILE: "文件无法读取，可能已损坏或格式不匹配。",
  ENCRYPTED_PDF: "暂不支持加密 PDF，请先移除密码。",
  ANIMATED_IMAGE: "暂不支持动态图，请使用静态图片。",
  BROWSER_UNSUPPORTED:
    "当前浏览器不支持此转换，请使用新版 Chrome、Edge、Firefox 或 Safari。",
  ENGINE_LOAD: "本地转换引擎加载失败，请检查网络后重试。文件不会上传。",
  IMAGE_LIMIT: "图片像素过大，请先缩小至 2400 万像素以内。",
  WORD_LIMIT: "文档内容过大，请缩减至 30 页以内后重试。",
  TIMEOUT: "转换超时，请缩小文件后重试。",
  FAILED: "转换失败，请检查文件后重试。",
  NO_AUDIO: "该文件不包含可提取的音轨。",
  INCOMPATIBLE_CODEC: "该视频无法快速封装，请改用兼容模式。",
  MEDIA_LIMIT: "视频需在 5 分钟以内，分辨率不超过 1080p。",
  OUTPUT_TOO_LARGE: "转换结果过大，请缩小源文件后重试。",
};
