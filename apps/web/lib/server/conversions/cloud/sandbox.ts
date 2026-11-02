import { Sandbox } from "@vercel/sandbox";
import { ConversionError, conversionErrors } from "../../../conversions.ts";
import { JOB_TIMEOUT_MS, MAX_OUTPUT_BYTES } from "../config.ts";
import { sandboxCredentials } from "./config.ts";
import { expectedOutput, type CloudJob } from "./model.ts";
import { signedInput } from "./blob.ts";
import { cloudStore } from "./store.ts";
import { publishResult } from "./publish.ts";

const FOLDER = "/vercel/sandbox/job";
const RUNNER = "/opt/auden/scripts/sandbox-runner.ts";

// Trusted bootstrap program. It only downloads URLs issued by this server;
// submitted documents never run while network access is enabled.
const downloader = `
const { readFile, stat, rename, rm } = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
(async () => {
  const files = JSON.parse(await readFile('${FOLDER}/downloads.json', 'utf8'));
  for (const file of files) {
    const path = '${FOLDER}/' + file.filename;
    if ((await stat(path).catch(() => null))?.size === file.size) continue;
    const response = await fetch(file.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error('Download failed');
    let size = 0;
    const meter = new Transform({ transform(chunk, enc, done) {
      size += chunk.length;
      done(size > file.size ? new Error('Size exceeded') : null, chunk);
    }});
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(path + '.part', {mode: 0o600}));
    if (size !== file.size) throw new Error('Size mismatch');
    await rename(path + '.part', path);
  }
  await rm('${FOLDER}/downloads.json', {force: true});
})().catch(() => process.exit(1));`;

export async function launchSandbox(job: CloudJob) {
  const downloads = await Promise.all(
    job.inputs.map(async (input) => ({
      filename: input.filename,
      size: input.size,
      url: await signedInput(input.pathname),
    })),
  );
  const domains = Object.fromEntries(
    downloads.map((file) => [new URL(file.url).hostname, []]),
  );
  const sandbox = await Sandbox.getOrCreate({
    ...sandboxCredentials(),
    name: job.sandboxName,
    image: process.env.CONVERSION_SANDBOX_IMAGE!,
    persistent: false,
    resources: { vcpus: 2 },
    timeout: JOB_TIMEOUT_MS + 5 * 60 * 1000,
    networkPolicy: { allow: domains },
  });
  if (sandbox.status !== "running") throw new ConversionError("INTERRUPTED");
  if (await sandbox.readFileToBuffer({ path: `${FOLDER}/runner.lock` })) return;
  await sandbox.mkDir(FOLDER);
  await sandbox.writeFiles([
    {
      path: `${FOLDER}/downloads.json`,
      content: Buffer.from(JSON.stringify(downloads)),
    },
    {
      path: `${FOLDER}/job.json`,
      content: Buffer.from(
        JSON.stringify({
          operation: job.operation,
          options: job.options,
          inputs: job.inputs.map(({ name, size, filename }) => ({
            name,
            size,
            filename,
          })),
        }),
      ),
    },
  ]);
  const download = await sandbox.runCommand({
    cmd: "node",
    args: ["-e", downloader],
    timeoutMs: 240000,
  });
  if (download.exitCode !== 0) throw new ConversionError("UPLOAD_FAILED");
  await sandbox.update({ networkPolicy: "deny-all" });
  // Cancellation can arrive while the VM boots or downloads.
  const current = await cloudStore().get(job.id);
  if (!current || current.hidden || current.status !== "running") {
    await sandbox.stop();
    return;
  }
  await sandbox.runCommand({
    cmd: "node",
    args: ["--max-old-space-size=1024", RUNNER, FOLDER],
    cwd: "/opt/auden",
    detached: true,
    timeoutMs: JOB_TIMEOUT_MS,
    env: {
      LIBREOFFICE_PATH: "/usr/bin/soffice",
      FFMPEG_PATH: "/usr/bin/ffmpeg",
      FFPROBE_PATH: "/usr/bin/ffprobe",
    },
  });
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    "response" in error &&
    error.response instanceof Response &&
    error.response.status === 404
  );
}

export async function stopSandbox(job: CloudJob, remove = false) {
  let sandbox;
  try {
    sandbox = await Sandbox.get({
      ...sandboxCredentials(),
      name: job.sandboxName,
      resume: false,
    });
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  // stop/delete never resume a stopped sandbox. persistent:false discards its files.
  if (remove) await sandbox.delete();
  else await sandbox.stop();
}

export async function pollSandbox(job: CloudJob): Promise<"running" | "done"> {
  const store = cloudStore();
  if (Date.now() - (job.startedAt ?? job.updatedAt) > JOB_TIMEOUT_MS) {
    await store.finish(job.id, null, "TIMEOUT");
    return "done";
  }
  const sandbox = await Sandbox.get({
    ...sandboxCredentials(),
    name: job.sandboxName,
    resume: false,
  });
  if (sandbox.status !== "running") {
    await store.finish(job.id, null, "INTERRUPTED");
    return "done";
  }
  const bytes = await sandbox.readFileToBuffer({
    path: `${FOLDER}/status.json`,
  });
  if (!bytes) return "running";
  if (bytes.length > 4096) throw new ConversionError("FAILED");
  const status = JSON.parse(bytes.toString()) as {
    state: string;
    progress?: number;
    error?: string;
    output?: { filename: string; size: number };
  };
  if (status.state === "failed") {
    await store.finish(
      job.id,
      null,
      status.error && status.error in conversionErrors
        ? status.error
        : "FAILED",
    );
    return "done";
  }
  if (status.state !== "done") {
    if (typeof status.progress === "number")
      await store.progress(job.id, status.progress);
    return "running";
  }
  const output = expectedOutput(job),
    size = status.output?.size;
  if (
    status.output?.filename !== output.filename ||
    !Number.isSafeInteger(size) ||
    !size ||
    size < 1 ||
    size >= MAX_OUTPUT_BYTES
  )
    throw new ConversionError("INVALID_FILE");
  const source = await sandbox.readFile({
    path: `${FOLDER}/${output.filename}`,
  });
  if (!source) throw new ConversionError("INVALID_FILE");
  await publishResult(
    job.id,
    { ...output, size },
    source as AsyncIterable<Uint8Array>,
    store,
  );
  return "done";
}
