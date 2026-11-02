import { ConversionError } from "../lib/conversions.ts";
import { runConversion } from "../lib/server/conversions/engines.ts";
import { conversionStore } from "../lib/server/conversions/store.ts";

const store = conversionStore(),
  id = process.argv[2];
if (!id) throw new Error("Missing conversion ID");
const job = store.get(id);
if (!job || job.status !== "running") process.exit(1);
let lastProgress = -1;
try {
  const output = await runConversion(job, store.folder(id), (percent) => {
    const rounded = Math.round(percent);
    if (rounded !== lastProgress) {
      store.progress(id, percent);
      lastProgress = rounded;
    }
  });
  store.finish(id, output);
} catch (error) {
  store.finish(
    id,
    null,
    error instanceof ConversionError ? error.code : "INVALID_FILE",
  );
} finally {
  store.close();
}
