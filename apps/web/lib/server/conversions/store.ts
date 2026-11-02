import { mkdirSync } from "node:fs";
import { rm, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  ConversionError,
  RETENTION_MS,
  conversionSpecs,
  type ConversionId,
  type ConversionOptions,
  type ConversionJob,
  type InputFile,
  type OutputFile,
  type Capabilities,
} from "../../conversions.ts";
import {
  conversionConfig,
  MAX_OUTPUT_BYTES,
  STORAGE_BUDGET,
  UPLOAD_TIMEOUT_MS,
} from "./config.ts";

export type StoredJob = Omit<ConversionJob, "inputs" | "output"> & {
  owner: string;
  inputs: InputFile[];
  output: OutputFile | null;
  options: ConversionOptions;
  updatedAt: number;
  reservedBytes: number;
  worker: string | null;
  cancelRequested: boolean;
};
type JobRow = { payload: string; status: string };

export class ConversionStore {
  readonly directory: string;
  readonly db: DatabaseSync;
  constructor(directory: string) {
    this.directory = directory;
    mkdirSync(join(directory, "jobs"), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, "queue.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL, reserved INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner, created);
      CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created);
      CREATE TABLE IF NOT EXISTS workers (id TEXT PRIMARY KEY, heartbeat INTEGER NOT NULL, capabilities TEXT NOT NULL);`);
  }
  close() {
    this.db.close();
  }
  folder(id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id,
      )
    )
      throw new ConversionError("NOT_FOUND");
    return join(this.directory, "jobs", id);
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private save(job: StoredJob) {
    this.db
      .prepare(
        "UPDATE jobs SET status=?, expires=?, reserved=?, payload=? WHERE id=?",
      )
      .run(
        job.status,
        job.expiresAt,
        job.reservedBytes,
        JSON.stringify(job),
        job.id,
      );
  }
  get(id: string): StoredJob | null {
    const row = this.db
      .prepare("SELECT payload, status FROM jobs WHERE id=?")
      .get(id) as JobRow | undefined;
    return row ? (JSON.parse(row.payload) as StoredJob) : null;
  }
  owned(id: string, owner: string | null) {
    const job = this.get(id);
    if (!owner || !job || job.owner !== owner || job.expiresAt <= Date.now())
      throw new ConversionError("NOT_FOUND");
    return job;
  }
  list(owner: string) {
    return (
      this.db
        .prepare(
          "SELECT payload FROM jobs WHERE owner=? AND expires>? ORDER BY created DESC LIMIT 20",
        )
        .all(owner, Date.now()) as { payload: string }[]
    ).map((row) => publicJob(JSON.parse(row.payload)));
  }
  reserve(
    owner: string,
    operation: ConversionId,
    options: ConversionOptions,
  ): StoredJob {
    return this.transaction(() => {
      const now = Date.now();
      const active = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM jobs WHERE owner=? AND status IN ('uploading','queued','running')",
        )
        .get(owner) as { n: number };
      const recent = this.db
        .prepare("SELECT COUNT(*) AS n FROM jobs WHERE owner=? AND created>?")
        .get(owner, now - RETENTION_MS) as { n: number };
      const total = this.db
        .prepare(
          "SELECT COALESCE(SUM(reserved),0) AS bytes, COUNT(*) AS n FROM jobs",
        )
        .get() as { bytes: number; n: number };
      const reservation =
        conversionSpecs[operation].maxTotalBytes + MAX_OUTPUT_BYTES;
      if (active.n >= 2 || recent.n >= 20)
        throw new ConversionError("RATE_LIMIT");
      if (total.bytes + reservation > STORAGE_BUDGET || total.n >= 100)
        throw new ConversionError("BUSY");
      const job: StoredJob = {
        id: randomUUID(),
        owner,
        operation,
        options,
        status: "uploading",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + RETENTION_MS,
        inputs: [],
        output: null,
        progress: null,
        error: null,
        reservedBytes: reservation,
        worker: null,
        cancelRequested: false,
      };
      this.db
        .prepare("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(
          job.id,
          owner,
          job.status,
          job.expiresAt,
          job.createdAt,
          reservation,
          JSON.stringify(job),
        );
      return job;
    });
  }
  enqueue(id: string, inputs: InputFile[]) {
    this.transaction(() => {
      const job = this.get(id);
      if (!job || job.status !== "uploading")
        throw new ConversionError("NOT_FOUND");
      job.inputs = inputs;
      job.status = "queued";
      job.updatedAt = Date.now();
      job.reservedBytes =
        inputs.reduce((sum, file) => sum + file.size, 0) + MAX_OUTPUT_BYTES;
      this.save(job);
    });
  }
  claim(worker: string): StoredJob | null {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT payload FROM jobs WHERE status='queued' AND expires>? ORDER BY created LIMIT 1",
        )
        .get(Date.now()) as { payload: string } | undefined;
      if (!row) return null;
      const job = JSON.parse(row.payload) as StoredJob;
      job.status = "running";
      job.worker = worker;
      job.updatedAt = Date.now();
      this.save(job);
      return job;
    });
  }
  progress(id: string, value: number) {
    this.transaction(() => {
      const job = this.get(id);
      if (!job || job.status !== "running" || job.cancelRequested) return;
      job.progress = Math.max(
        job.progress ?? 0,
        Math.min(99, Math.max(0, Math.round(value))),
      );
      job.updatedAt = Date.now();
      this.save(job);
    });
  }
  finish(id: string, output: OutputFile | null, error: string | null = null) {
    this.transaction(() => {
      const job = this.get(id);
      if (!job || !["running", "queued", "uploading"].includes(job.status))
        return;
      job.status = job.cancelRequested
        ? "cancelled"
        : output
          ? "succeeded"
          : "failed";
      job.output = job.status === "succeeded" ? output : null;
      job.progress = job.output ? 100 : null;
      job.error = job.status === "failed" ? error || "FAILED" : null;
      job.updatedAt = Date.now();
      job.expiresAt = Date.now() + RETENTION_MS;
      // Keep the conservative reservation until cleanup; temporary engine files
      // and failed outputs also consume disk space.
      this.save(job);
    });
  }
  cancel(id: string, owner: string) {
    return this.transaction(() => {
      const job = this.owned(id, owner);
      job.cancelRequested = true;
      // Running work is killed by the worker before its files can be removed.
      if (job.status !== "running") {
        job.status = "cancelled";
        job.output = null;
        job.expiresAt = Date.now();
      }
      this.save(job);
      return job;
    });
  }
  async remove(id: string) {
    await rm(this.folder(id), { recursive: true, force: true });
    this.db.prepare("DELETE FROM jobs WHERE id=?").run(id);
  }
  async compact(id: string) {
    const job = this.get(id);
    if (!job || ["uploading", "queued", "running"].includes(job.status)) return;
    const folder = this.folder(id);
    const keep = new Set([
      ...job.inputs.map((file) => file.filename),
      ...(job.output ? [job.output.filename] : []),
    ]);
    let bytes = 0;
    for (const name of await readdir(folder).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    })) {
      if (keep.has(name))
        bytes += (
          await stat(join(folder, name)).catch((error) => {
            if (error.code === "ENOENT") return { size: 0 };
            throw error;
          })
        ).size;
      else await rm(join(folder, name), { recursive: true, force: true });
    }
    this.transaction(() => {
      const current = this.get(id);
      if (!current) return;
      current.reservedBytes = bytes;
      this.save(current);
    });
  }
  heartbeat(id: string, capabilities: Omit<Capabilities, "online">) {
    this.db
      .prepare(
        "INSERT INTO workers VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat, capabilities=excluded.capabilities",
      )
      .run(id, Date.now(), JSON.stringify(capabilities));
  }
  capabilities(): Capabilities {
    const rows = this.db
      .prepare("SELECT capabilities FROM workers WHERE heartbeat>?")
      .all(Date.now() - 15000) as { capabilities: string }[];
    const caps = rows.map(
      (row) => JSON.parse(row.capabilities) as Capabilities,
    );
    // All workers attached to one queue must be capable of the operation.
    return {
      online: caps.length > 0,
      ffmpeg: caps.length > 0 && caps.every((cap) => cap.ffmpeg),
      office: caps.length > 0 && caps.every((cap) => cap.office),
    };
  }
  stopWorker(id: string) {
    this.db.prepare("DELETE FROM workers WHERE id=?").run(id);
  }
  async cleanup() {
    const rows = this.db.prepare("SELECT payload FROM jobs").all() as {
      payload: string;
    }[];
    const now = Date.now();
    for (const { payload } of rows) {
      const job = JSON.parse(payload) as StoredJob;
      if (job.status === "running") {
        const alive = this.db
          .prepare("SELECT id FROM workers WHERE id=? AND heartbeat>?")
          .get(job.worker, now - 30000);
        if (!alive && now - job.updatedAt > 30000)
          this.finish(job.id, null, "INTERRUPTED");
      } else if (
        job.expiresAt <= now ||
        (job.status === "uploading" &&
          now - job.createdAt > UPLOAD_TIMEOUT_MS + 30000)
      ) {
        await this.remove(job.id);
      }
    }
    this.db
      .prepare("DELETE FROM workers WHERE heartbeat<?")
      .run(now - RETENTION_MS);
  }
}

export function publicJob(job: StoredJob): ConversionJob {
  return {
    id: job.id,
    operation: job.operation,
    status: job.status,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    progress: job.progress,
    error: job.error,
    inputs: job.inputs.map(({ name, size }) => ({ name, size })),
    output: job.output
      ? { name: job.output.name, size: job.output.size, mime: job.output.mime }
      : null,
  };
}
const globalStore = globalThis as typeof globalThis & {
  audenConversionStore?: ConversionStore;
};
export function conversionStore() {
  return (globalStore.audenConversionStore ??= new ConversionStore(
    conversionConfig().directory,
  ));
}
