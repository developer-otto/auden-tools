import { build } from "esbuild";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "public/conversion");
await mkdir(output, { recursive: true });
// Serve the engine from our own origin: no CDN, cross-origin headers or keys.
const wrapper = dirname(
  fileURLToPath(import.meta.resolve("@ffmpeg/ffmpeg/worker")),
);
const core = dirname(fileURLToPath(import.meta.resolve("@ffmpeg/core")));
await cp(wrapper, resolve(output, "ffmpeg"), { recursive: true });
await cp(core, resolve(output, "core"), { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ["lib/browser/conversion-worker.ts"],
  outfile: resolve(output, "worker.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "linked",
});
await writeFile(
  resolve(output, "NOTICE.txt"),
  [
    "ffmpeg.wasm wrapper 0.12.15: MIT — https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.15",
    "ffmpeg.wasm core 0.12.10: GPL-2.0-or-later; source/build scripts: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10",
    "FFmpeg: https://ffmpeg.org/legal.html — license: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
    "pdf-lib: MIT — https://github.com/Hopding/pdf-lib",
  ].join("\n") + "\n",
);
console.log(
  "Browser conversion assets prepared (including the single-thread WASM engine).",
);
