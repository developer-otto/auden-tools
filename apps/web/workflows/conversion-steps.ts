import { ConversionError } from "../lib/conversions";
import { cloudStore } from "../lib/server/conversions/cloud/store";
import {
  launchSandbox,
  pollSandbox,
  stopSandbox,
} from "../lib/server/conversions/cloud/sandbox";
import { cleanupJob } from "../lib/server/conversions/cloud/lifecycle";
import { cleanupDeadline } from "../lib/server/conversions/cloud/model";

export async function inspectUpload(id: string) {
  "use step";
  const store = cloudStore(),
    job = await store.get(id);
  if (!job || job.hidden) return "done";
  if (job.status === "uploading") {
    if (Date.now() >= job.uploadDeadline) {
      await store.finish(id, null, "UPLOAD_TIMEOUT");
      return "done";
    }
    return "waiting";
  }
  return ["queued", "running"].includes(job.status) ? "ready" : "done";
}
export async function prepareConversion(id: string) {
  "use step";
  console.info("conversion.prepare", { id });
  const store = cloudStore(),
    job = await store.claim(id);
  if (!job || job.hidden || job.status !== "running") return;
  try {
    await launchSandbox(job);
  } catch (error) {
    if (!(error instanceof ConversionError)) throw error;
    await store.finish(id, null, error.code);
  }
}
export async function tickConversion(id: string) {
  "use step";
  const job = await cloudStore().get(id);
  if (!job || job.hidden || job.status !== "running") return false;
  return (await pollSandbox(job)) === "running";
}
export async function failConversion(id: string) {
  "use step";
  console.warn("conversion.failed", { id });
  await cloudStore().finish(id, null, "FAILED");
}
export async function releaseSandbox(id: string) {
  "use step";
  const job = await cloudStore().get(id);
  if (job) await stopSandbox(job);
}
export async function cleanupAt(id: string) {
  "use step";
  const job = await cloudStore().get(id);
  return job ? cleanupDeadline(job) : null;
}
export async function purgeConversion(id: string) {
  "use step";
  console.info("conversion.purge", { id });
  await cleanupJob(id);
}
purgeConversion.maxRetries = 8;
releaseSandbox.maxRetries = 8;
