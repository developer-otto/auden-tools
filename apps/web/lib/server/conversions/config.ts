import { resolve } from "node:path";

export function conversionConfig() {
  return {
    // Runtime uploads belong to a mounted volume, never to the build output.
    directory: resolve(
      /* turbopackIgnore: true */ process.env.CONVERSION_DATA_DIR ||
        ".data/conversions",
    ),
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH || "ffprobe",
    office:
      process.env.LIBREOFFICE_PATH ||
      (process.platform === "darwin"
        ? "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        : "soffice"),
    publicOrigin: process.env.APP_ORIGIN,
  };
}
export const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
export const STORAGE_BUDGET = 2 * 1024 * 1024 * 1024;
export const JOB_TIMEOUT_MS = 10 * 60 * 1000;
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
