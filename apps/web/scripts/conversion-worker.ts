import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { detectEngines } from "../lib/server/conversions/engines.ts";
import { conversionStore } from "../lib/server/conversions/store.ts";
import { JOB_TIMEOUT_MS } from "../lib/server/conversions/config.ts";

const store = conversionStore(),
  worker = randomUUID(),
  capabilities = await detectEngines();
let stopping = false,
  active: ChildProcess | null = null;
function killGroup(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(
      process.platform === "win32" ? child.pid : -child.pid,
      "SIGKILL",
    );
  } catch {
    /* Already exited. */
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
    if (active) killGroup(active);
  });
store.heartbeat(worker, capabilities);
process.stdout.write(
  `Conversion worker ready (images/PDF: yes, video: ${capabilities.ffmpeg ? "yes" : "no"}, Word: ${capabilities.office ? "yes" : "no"})\n`,
);
const heartbeat = setInterval(
  () => store.heartbeat(worker, capabilities),
  3000,
);
let lastCleanup = 0;
try {
  while (!stopping) {
    if (Date.now() - lastCleanup > 15000) {
      await store.cleanup();
      lastCleanup = Date.now();
    }
    const job = store.claim(worker);
    if (!job) {
      await delay(500);
      continue;
    }
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=512",
        fileURLToPath(new URL("./conversion-job.ts", import.meta.url)),
        job.id,
      ],
      {
        detached: process.platform !== "win32",
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    active = child;
    // Drain diagnostics without logging user filenames or document contents.
    child.stderr?.resume();
    let exited = false,
      failure: string | null = null;
    const completion = new Promise<void>((resolve) => {
      child.once("close", () => {
        exited = true;
        resolve();
      });
      child.once("error", () => {
        exited = true;
        failure = "FAILED";
        resolve();
      });
    });
    while (!exited) {
      const current = store.get(job.id);
      if (
        stopping ||
        current?.cancelRequested ||
        Date.now() - started > JOB_TIMEOUT_MS
      ) {
        failure = stopping
          ? "INTERRUPTED"
          : current?.cancelRequested
            ? null
            : "TIMEOUT";
        killGroup(child);
        break;
      }
      await delay(300);
    }
    await completion;
    // Also reap any native subprocess left behind by a crashed Node runner.
    killGroup(child);
    active = null;
    const current = store.get(job.id);
    if (current?.status === "running")
      store.finish(job.id, null, failure || "FAILED");
    if (current?.cancelRequested) await store.remove(job.id);
    else await store.compact(job.id);
  }
} finally {
  clearInterval(heartbeat);
  if (active) killGroup(active);
  store.stopWorker(worker);
  store.close();
}
