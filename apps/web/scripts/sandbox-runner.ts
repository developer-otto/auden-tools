// This entrypoint runs only inside the conversion image; it has no cloud credentials.
import { open, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  runConversion,
  type EngineJob,
} from "../lib/server/conversions/engines.ts";
import { ConversionError, conversionErrors } from "../lib/conversions.ts";

const directory = process.argv[2];
if (!directory) throw new Error("Missing job directory");
const folder: string = directory;
// A retried Workflow launch must never start a second converter in the same VM.
try {
  const lock = await open(join(folder, "runner.lock"), "wx", 0o600);
  await lock.close();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST") process.exit(0);
  throw error;
}
let pending = Promise.resolve();
function status(value: unknown) {
  pending = pending.then(async () => {
    const temporary = join(folder, "status.tmp");
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, join(folder, "status.json"));
  });
  return pending;
}
try {
  await status({ state: "running", progress: 0 });
  const job: EngineJob = JSON.parse(
    await readFile(join(folder, "job.json"), "utf8"),
  );
  let previous = -1;
  const output = await runConversion(job, folder, (value) => {
    const progress = Math.min(99, Math.max(0, Math.round(value)));
    if (progress > previous) {
      previous = progress;
      void status({ state: "running", progress });
    }
  });
  await status({ state: "done", output });
} catch (error) {
  const code =
    error instanceof ConversionError && error.code in conversionErrors
      ? error.code
      : "FAILED";
  await status({ state: "failed", error: code });
  process.exitCode = 1;
}
