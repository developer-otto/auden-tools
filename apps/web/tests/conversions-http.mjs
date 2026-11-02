// Run against local Worker mode or a configured Vercel deployment.
import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

const origin = process.argv[2] || "http://localhost:3000";
const initial = await fetch(`${origin}/api/conversions`);
assert.equal(initial.status, 200);
const cookie = initial.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const capabilities = (await initial.json()).capabilities;
const headers = { cookie, origin };
if (process.argv.includes("--unconfigured-cloud")) {
  assert.equal(capabilities.upload, "blob");
  assert.equal(capabilities.online, false);
  const unavailable = await fetch(`${origin}/api/conversions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error, "ENGINE_UNAVAILABLE");
  assert.equal((await fetch(`${origin}/api/conversions/cleanup`)).status, 403);
  assert.equal((await fetch(`${origin}/tools/timestamp`)).status, 200);
  console.log(
    "PASS unconfigured cloud mode stays unavailable, rejects unauthenticated cleanup, and serves core tools",
  );
  process.exit(0);
}
assert.equal(
  capabilities.online,
  true,
  "Start the local worker or configure the cloud conversion services first",
);
const created = [];
async function upload(operation, name, bytes, options = {}) {
  if (capabilities.upload === "blob") {
    const reservation = await fetch(`${origin}/api/conversions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        operation,
        options,
        files: [{ name, size: bytes.length }],
      }),
    });
    assert.equal(reservation.status, 201, await reservation.clone().text());
    const data = await reservation.json();
    created.push(data.job.id);
    const { upload: directUpload } = await import("@vercel/blob/client");
    await directUpload(data.uploads[0].pathname, new Blob([bytes]), {
      access: "private",
      handleUploadUrl: `${origin}/api/conversions/upload`,
      clientPayload: data.job.id,
      headers,
      multipart: bytes.length > 4 * 1024 * 1024,
    });
    const ready = await fetch(
      `${origin}/api/conversions/${data.job.id}/complete`,
      { method: "POST", headers },
    );
    assert.equal(ready.status, 202, await ready.clone().text());
    return (await ready.json()).job;
  }
  const form = new FormData();
  form.append("files", new Blob([bytes]), name);
  const response = await fetch(
    `${origin}/api/conversions?${new URLSearchParams({ operation, options: JSON.stringify(options) })}`,
    { method: "POST", headers, body: form },
  );
  assert.equal(response.status, 202, await response.clone().text());
  const { job } = await response.json();
  created.push(job.id);
  return job;
}
async function completed(id) {
  const start = Date.now();
  while (
    Date.now() - start <
    (capabilities.upload === "blob" ? 180000 : 30000)
  ) {
    const response = await fetch(`${origin}/api/conversions/${id}`, {
      headers,
    });
    assert.equal(response.status, 200);
    const { job } = await response.json();
    if (job.status === "succeeded" || job.status === "failed") return job;
    await delay(capabilities.upload === "blob" ? 1500 : 150);
  }
  throw new Error("Conversion did not finish");
}
try {
  assert.equal(
    (
      await fetch(`${origin}/api/conversions?operation=image`, {
        method: "POST",
      })
    ).status,
    403,
  );
  const malformed = await fetch(`${origin}/api/conversions?operation=image`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "multipart/form-data; boundary=abc",
    },
    body: '--abc\r\nContent-Disposition: form-data; name="files"\r\nContent-Type: application/octet-stream\r\n\r\ndata\r\n--abc--\r\n',
  });
  assert.equal(malformed.status, 400);
  assert.equal(
    (await malformed.json()).error,
    capabilities.upload === "blob" ? "INVALID_OPTIONS" : "FILE_TYPE",
  );
  const png = await sharp({
    create: { width: 64, height: 48, channels: 4, background: "#4c775d" },
  })
    .png()
    .toBuffer();
  const image = await upload("image", "测试图片.png", png, {
    imageFormat: "webp",
  });
  assert.equal((await completed(image.id)).status, "succeeded");
  assert.equal(
    (await fetch(`${origin}/api/conversions/${image.id}`)).status,
    404,
  );
  assert.equal(
    (await fetch(`${origin}/api/conversions/${image.id}/download`)).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/conversions/${image.id}`, {
        method: "DELETE",
        headers: { origin },
      })
    ).status,
    404,
  );
  const download = await fetch(
    `${origin}/api/conversions/${image.id}/download`,
    { headers },
  );
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "image/webp");
  assert.match(
    download.headers.get("content-disposition"),
    /filename\*=UTF-8''/,
  );
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.equal(Number(download.headers.get("content-length")), bytes.length);
  assert.equal((await sharp(bytes).metadata()).width, 64);
  const restored = (
    await (await fetch(`${origin}/api/conversions`, { headers })).json()
  ).jobs;
  assert.ok(restored.some((job) => job.id === image.id && job.output));
  process.stdout.write(
    "PASS upload → queue → download; Unicode filenames, persisted history and cross-session isolation\n",
  );
  const invalid = await upload("image", "broken.png", Buffer.from("not a PNG"));
  assert.equal((await completed(invalid.id)).status, "failed");
  const retried = await fetch(`${origin}/api/conversions/${invalid.id}`, {
    method: "POST",
    headers,
  });
  assert.equal(retried.status, 202);
  const { job: retry } = await retried.json();
  created.push(retry.id);
  assert.notEqual(retry.id, invalid.id);
  assert.equal((await completed(retry.id)).status, "failed");
  process.stdout.write(
    "PASS malformed-file failure and retry without re-upload\n",
  );
  const cancel = await upload("image", "cancel.png", png);
  assert.equal(
    (
      await fetch(`${origin}/api/conversions/${cancel.id}`, {
        method: "DELETE",
        headers,
      })
    ).status,
    200,
  );
  await delay(800);
  assert.equal(
    (await fetch(`${origin}/api/conversions/${cancel.id}`, { headers })).status,
    404,
  );
  process.stdout.write("PASS task cancellation and file removal\n");
  if (capabilities.office) {
    const word = await upload(
      "word-pdf",
      "测试文档.docx",
      await readFile(new URL("./fixtures/letter.docx", import.meta.url)),
    );
    const result = await completed(word.id);
    assert.equal(result.status, "succeeded", result.error);
    const pdf = await (
      await fetch(`${origin}/api/conversions/${word.id}/download`, { headers })
    ).arrayBuffer();
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
    process.stdout.write("PASS Word upload → LibreOffice → downloadable PDF\n");
  }
} finally {
  for (const id of created)
    await fetch(`${origin}/api/conversions/${id}`, {
      method: "DELETE",
      headers,
    });
}
