import { cloudStore } from "./store.ts";
import { deleteJobBlobs } from "./blob.ts";
import { stopSandbox } from "./sandbox.ts";
import { cleanupDeadline } from "./model.ts";

export async function cleanupJob(id: string) {
  const store = cloudStore(),
    job = await store.get(id);
  if (!job) return;
  await stopSandbox(job, true);
  await deleteJobBlobs(id);
  // Allow outstanding upload grants to expire; signed upload callbacks also
  // delete late arrivals. The durable workflow performs the final cleanup.
  if (Date.now() >= cleanupDeadline(job)) await store.remove(id);
}
