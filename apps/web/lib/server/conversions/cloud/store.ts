import { neon } from "@neondatabase/serverless";
import { ConversionError, RETENTION_MS } from "../../../conversions.ts";
import { STORAGE_BUDGET } from "../config.ts";
import {
  jobPrefix,
  publicJob,
  type CloudJob,
  type CloudOutput,
} from "./model.ts";

export type Query = (
  text: string,
  params: unknown[],
) => Promise<{ payload: CloudJob }[]>;
export class CloudStore {
  readonly query: Query;
  constructor(query: Query) {
    this.query = query;
  }
  async get(id: string) {
    jobPrefix(id);
    return (
      (
        await this.query(
          "SELECT payload FROM auden_conversion_jobs WHERE id = $1",
          [id],
        )
      )[0]?.payload ?? null
    );
  }
  async owned(id: string, owner: string | null) {
    const job = await this.get(id);
    if (
      !owner ||
      !job ||
      job.owner !== owner ||
      job.hidden ||
      job.expiresAt <= Date.now()
    )
      throw new ConversionError("NOT_FOUND");
    return job;
  }
  async list(owner: string) {
    const rows = await this.query(
      "SELECT payload FROM auden_conversion_jobs WHERE owner = $1 AND expires > $2 AND (payload->>'hidden')::boolean = false ORDER BY created DESC LIMIT 20",
      [owner, Date.now()],
    );
    return rows.map(({ payload }) => publicJob(payload));
  }
  async reserve(job: CloudJob) {
    try {
      return (
        await this.query(
          "SELECT auden_reserve_conversion($1::jsonb, $2::bigint) AS payload",
          [JSON.stringify(job), STORAGE_BUDGET],
        )
      )[0]!.payload;
    } catch (error) {
      if (error instanceof Error && /^(RATE_LIMIT|BUSY)$/.test(error.message))
        throw new ConversionError(error.message);
      throw error;
    }
  }
  async setRun(id: string, runId: string) {
    await this.query(
      "UPDATE auden_conversion_jobs SET payload = payload || $2::jsonb WHERE id = $1 RETURNING payload",
      [id, JSON.stringify({ runId })],
    );
  }
  async enqueue(id: string) {
    const rows = await this.query(
      "UPDATE auden_conversion_jobs SET payload = payload || $2::jsonb WHERE id = $1 AND status = 'uploading' AND (payload->>'uploadDeadline')::bigint > $3 RETURNING payload",
      [
        id,
        JSON.stringify({ status: "queued", updatedAt: Date.now() }),
        Date.now(),
      ],
    );
    if (rows[0]) return rows[0].payload;
    const job = await this.get(id);
    if (
      !job ||
      job.hidden ||
      !["queued", "running", "succeeded"].includes(job.status)
    )
      throw new ConversionError("NOT_FOUND");
    return job;
  }
  async claim(id: string) {
    await this.query(
      "UPDATE auden_conversion_jobs SET payload = payload || $2::jsonb WHERE id = $1 AND status = 'queued' RETURNING payload",
      [
        id,
        JSON.stringify({
          status: "running",
          startedAt: Date.now(),
          updatedAt: Date.now(),
        }),
      ],
    );
    return this.get(id);
  }
  async progress(id: string, value: number) {
    const progress = Math.max(0, Math.min(99, Math.round(value)));
    if (!Number.isFinite(progress)) return;
    await this.query(
      "UPDATE auden_conversion_jobs SET payload = payload || jsonb_build_object('progress', greatest(coalesce((payload->>'progress')::int, 0), $2::int), 'updatedAt', $3::bigint) WHERE id = $1 AND status = 'running' RETURNING payload",
      [id, progress, Date.now()],
    );
  }
  async finish(
    id: string,
    output: CloudOutput | null,
    error: string | null = null,
  ) {
    const patch = {
      output,
      status: output ? "succeeded" : "failed",
      progress: output ? 100 : null,
      error: output ? null : error || "FAILED",
      updatedAt: Date.now(),
      expiresAt: Date.now() + RETENTION_MS,
    };
    const rows = await this.query(
      "UPDATE auden_conversion_jobs SET payload = payload || $2::jsonb || CASE WHEN $3::bigint IS NOT NULL THEN jsonb_build_object('reservedBytes', (SELECT coalesce(sum((item->>'size')::bigint), 0) FROM jsonb_array_elements(payload->'inputs') AS item) + $3::bigint) ELSE '{}'::jsonb END WHERE id = $1 AND status IN ('uploading','queued','running') AND (payload->>'hidden')::boolean = false RETURNING payload",
      [id, JSON.stringify(patch), output?.size ?? null],
    );
    return rows[0]?.payload ?? null;
  }
  async cancel(id: string, owner: string) {
    await this.owned(id, owner);
    return (
      await this.query(
        "UPDATE auden_conversion_jobs SET payload = payload || $3::jsonb WHERE id = $1 AND owner = $2 RETURNING payload",
        [
          id,
          owner,
          JSON.stringify({
            hidden: true,
            status: "cancelled",
            output: null,
            expiresAt: Date.now(),
            updatedAt: Date.now(),
          }),
        ],
      )
    )[0]!.payload;
  }
  async expired(now = Date.now()) {
    return (
      await this.query(
        "SELECT payload FROM auden_conversion_jobs WHERE expires <= $1 ORDER BY expires LIMIT 100",
        [now],
      )
    ).map((row) => row.payload);
  }
  async remove(id: string) {
    await this.query(
      "DELETE FROM auden_conversion_jobs WHERE id = $1 RETURNING payload",
      [id],
    );
  }
  async pruneQuota() {
    await this.query(
      "DELETE FROM auden_conversion_submissions WHERE created < $1",
      [Date.now() - RETENTION_MS],
    );
  }
}

let store: CloudStore | undefined;
export function cloudStore() {
  if (!store) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new ConversionError("ENGINE_UNAVAILABLE");
    const sql = neon(url);
    store = new CloudStore(
      async (text, params) =>
        (await sql.query(text, params)) as { payload: CloudJob }[],
    );
  }
  return store;
}
