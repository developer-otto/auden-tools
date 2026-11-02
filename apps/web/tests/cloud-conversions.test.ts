import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import sharp from "sharp";
import { Readable } from "node:stream";
import type { PutBlobResult } from "@vercel/blob";
import { publishResult } from "../lib/server/conversions/cloud/publish.ts";
import {
  ConversionError,
  defaultConversionOptions,
  conversionSpecs,
} from "../lib/conversions.ts";
import {
  createCloudJob,
  parseManifest,
  uploadGrant,
  publicJob,
  expectedOutput,
  cleanupDeadline,
  type CloudJob,
} from "../lib/server/conversions/cloud/model.ts";
import { CloudStore } from "../lib/server/conversions/cloud/store.ts";
import { readJson } from "../lib/server/conversions/http.ts";

const code = (value: string) => (error: unknown) =>
  error instanceof ConversionError && error.code === value;
const owner = "a".repeat(64),
  otherOwner = "b".repeat(64);
const draft = (who = owner) =>
  createCloudJob(who, "image", defaultConversionOptions, [
    { name: "照片.png", size: 300 },
  ]);
const migration = await readFile(
  new URL("../db/001-conversions.sql", import.meta.url),
  "utf8",
);
async function database() {
  const db = new PGlite();
  await db.exec(migration);
  const store = new CloudStore(
    async (text, params) =>
      (await db.query<{ payload: CloudJob }>(text, params)).rows,
  );
  return { db, store };
}

test("cloud upload grants bind owner, pathname, exact size and expiry", () => {
  const job = draft(),
    path = job.inputs[0]!.pathname;
  const grant = uploadGrant(job, path, owner);
  assert.equal(grant.maximumSizeInBytes, 300);
  assert.equal(grant.validUntil, job.uploadDeadline);
  assert.equal(grant.allowOverwrite, false);
  assert.throws(() => uploadGrant(job, path, otherOwner), code("NOT_FOUND"));
  assert.throws(
    () => uploadGrant(job, `${path}/../../other`, owner),
    code("FORBIDDEN"),
  );
  assert.throws(
    () => uploadGrant(job, path, owner, job.uploadDeadline),
    code("NOT_FOUND"),
  );
  assert.throws(
    () => uploadGrant({ ...job, status: "queued" }, path, owner),
    code("NOT_FOUND"),
  );
  assert.throws(
    () => uploadGrant({ ...job, hidden: true }, path, owner),
    code("NOT_FOUND"),
  );
  const exposed = JSON.stringify(publicJob(job));
  for (const privateValue of [
    owner,
    path,
    job.sandboxName,
    "reservedBytes",
    "options",
    "uploadDeadline",
  ])
    assert.equal(exposed.includes(privateValue), false);
});

test("cloud manifests reject invalid sizes/options and sanitize paths", async () => {
  for (const size of [-1, 0, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() =>
      parseManifest({
        operation: "image",
        options: {},
        files: [{ name: "a.png", size }],
      }),
    );
  assert.throws(
    () =>
      parseManifest({
        operation: "pdf-split",
        options: { pages: 1 },
        files: [{ name: "a.pdf", size: 20 }],
      }),
    code("INVALID_OPTIONS"),
  );
  const job = createCloudJob(owner, "image", defaultConversionOptions, [
    { name: "../../私密/照片.png", size: 10 },
  ]);
  assert.equal(job.inputs[0]!.name, "照片.png");
  assert.equal(job.inputs[0]!.filename, "input-0.png");
  assert.equal(expectedOutput(job).name, "照片.webp");
  await assert.rejects(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '"' + "x".repeat(32768) + '"',
      }),
    ),
    code("INVALID_OPTIONS"),
  );
});

test("Postgres reservations serialize limits and retain quota after deletion", async () => {
  const { db, store } = await database();
  try {
    const jobs = [draft(), draft(), draft()];
    const results = await Promise.allSettled(
      jobs.map((job) => store.reserve(job)),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      2,
    );
    const rejection = results.find((result) => result.status === "rejected");
    assert.ok(
      rejection?.status === "rejected" && code("RATE_LIMIT")(rejection.reason),
    );
    for (const job of jobs) await store.remove(job.id);
    for (let i = 2; i < 20; i++) {
      const job = await store.reserve(draft());
      await store.remove(job.id);
    }
    await assert.rejects(store.reserve(draft()), code("RATE_LIMIT"));
    const large = () =>
      createCloudJob(
        crypto.randomUUID(),
        "video-mp4",
        defaultConversionOptions,
        [{ name: "clip.mov", size: conversionSpecs["video-mp4"].maxFileBytes }],
      );
    for (let i = 0; i < 4; i++) await store.reserve(large());
    await assert.rejects(store.reserve(large()), code("BUSY"));
  } finally {
    await db.close();
  }
});

test("Postgres ownership, idempotent enqueue, progress and cancellation races", async () => {
  const { db, store } = await database();
  try {
    const job = await store.reserve(draft());
    await assert.rejects(store.owned(job.id, otherOwner), code("NOT_FOUND"));
    await assert.rejects(store.owned("../../x", owner), code("NOT_FOUND"));
    await store.enqueue(job.id);
    assert.equal((await store.enqueue(job.id)).status, "queued");
    await store.claim(job.id);
    await store.progress(job.id, 80);
    await store.progress(job.id, 20);
    assert.equal((await store.get(job.id))?.progress, 80);
    await store.cancel(job.id, owner);
    const completed = await store.finish(job.id, {
      ...expectedOutput(job),
      size: 20,
    });
    assert.equal(
      completed,
      null,
      "late conversion completion must not resurrect a cancelled job",
    );
    assert.deepEqual(await store.list(owner), []);
    await assert.rejects(store.owned(job.id, owner), code("NOT_FOUND"));
    assert.equal((await store.expired()).length, 1);
    const expired = draft(otherOwner);
    expired.uploadDeadline = Date.now() - 1;
    await store.reserve(expired);
    await assert.rejects(store.enqueue(expired.id), code("NOT_FOUND"));
  } finally {
    await db.close();
  }
});

test("Sandbox runner converts a real file and ignores duplicate launches", async () => {
  const folder = await mkdtemp(join(tmpdir(), "auden-sandbox-test-"));
  try {
    const bytes = await sharp({
      create: { width: 40, height: 30, channels: 4, background: "#ff000080" },
    })
      .png()
      .toBuffer();
    const job = createCloudJob(
      owner,
      "image",
      { ...defaultConversionOptions, imageFormat: "jpeg" },
      [{ name: "图片.png", size: bytes.length }],
    );
    await writeFile(join(folder, job.inputs[0]!.filename), bytes);
    await writeFile(join(folder, "job.json"), JSON.stringify(job));
    const runner = new URL("../scripts/sandbox-runner.ts", import.meta.url)
      .pathname;
    const run = promisify(execFile);
    await Promise.all([
      run(process.execPath, [runner, folder]),
      run(process.execPath, [runner, folder]),
    ]);
    const status = JSON.parse(
      await readFile(join(folder, "status.json"), "utf8"),
    );
    assert.equal(status.state, "done");
    assert.equal(status.output.filename, expectedOutput(job).filename);
    const metadata = await sharp(
      join(folder, status.output.filename),
    ).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 40);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("cloud result publication removes late uploads after cancellation and rejects truncated streams", async () => {
  const { db, store } = await database();
  try {
    const cancelled = await store.reserve(draft());
    await store.enqueue(cancelled.id);
    await store.claim(cancelled.id);
    const removed: string[] = [];
    await publishResult(
      cancelled.id,
      { ...expectedOutput(cancelled), size: 3 },
      Readable.from([Buffer.from("abc")]),
      store,
      async (_path, body) => {
        for await (const chunk of body as AsyncIterable<Uint8Array>)
          assert.ok(chunk.byteLength);
        await store.cancel(cancelled.id, owner);
        return {} as PutBlobResult;
      },
      async (path) => {
        removed.push(String(path));
      },
    );
    assert.deepEqual(removed, [expectedOutput(cancelled).pathname]);
    const hidden = (await store.get(cancelled.id))!;
    assert.ok(
      cleanupDeadline(hidden) >= hidden.updatedAt + 600000,
      "retain a tombstone for uploads still in flight",
    );
    const partial = await store.reserve(draft(otherOwner));
    await store.enqueue(partial.id);
    await store.claim(partial.id);
    await assert.rejects(
      publishResult(
        partial.id,
        { ...expectedOutput(partial), size: 4 },
        Readable.from([Buffer.from("abc")]),
        store,
        async (_path, body) => {
          for await (const chunk of body as AsyncIterable<Uint8Array>)
            assert.ok(chunk.byteLength);
          return {} as PutBlobResult;
        },
        async (path) => {
          removed.push(String(path));
        },
      ),
      code("INVALID_FILE"),
    );
    assert.equal((await store.get(partial.id))?.status, "running");
    assert.ok(removed.includes(expectedOutput(partial).pathname));
    const successful = await store.reserve(draft("c".repeat(64)));
    await store.enqueue(successful.id);
    await store.claim(successful.id);
    await publishResult(
      successful.id,
      { ...expectedOutput(successful), size: 3 },
      Readable.from([Buffer.from("abc")]),
      store,
      async (_path, body) => {
        for await (const chunk of body as AsyncIterable<Uint8Array>)
          assert.ok(chunk.byteLength);
        return {} as PutBlobResult;
      },
      async () => {
        assert.fail("a committed result must not be removed");
      },
    );
    const saved = (await store.get(successful.id))!;
    assert.equal(saved.status, "succeeded");
    assert.equal(saved.progress, 100);
    assert.equal(
      saved.reservedBytes,
      303,
      "release unused output reservation after success",
    );
  } finally {
    await db.close();
  }
});
