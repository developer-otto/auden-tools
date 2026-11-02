import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { ConversionError, conversionSpecs } from "../../../../lib/conversions";
import { start } from "workflow/api";
import { conversionWorkflow } from "../../../../workflows/conversion";
import {
  cloudMode,
  requireCloud,
} from "../../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../../lib/server/conversions/cloud/store";
import {
  createCloudJob,
  publicJob,
} from "../../../../lib/server/conversions/cloud/model";
import { copyInputs } from "../../../../lib/server/conversions/cloud/blob";
import { cleanupJob } from "../../../../lib/server/conversions/cloud/lifecycle";
import {
  session,
  verifyOrigin,
  jsonResponse,
  conversionFailure,
} from "../../../../lib/server/conversions/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    if (cloudMode())
      return jsonResponse({
        job: publicJob(
          await cloudStore().owned((await params).id, session(request).owner),
        ),
      });
    const { conversionStore } =
      await import("../../../../lib/server/conversions/store");
    return jsonResponse({
      job: publicJob(
        conversionStore().owned((await params).id, session(request).owner),
      ),
    });
  } catch (error) {
    return conversionFailure(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    verifyOrigin(request);
    const { owner } = session(request);
    if (!owner) throw new ConversionError("NOT_FOUND");
    if (cloudMode()) {
      const job = await cloudStore().cancel((await params).id, owner);
      await cleanupJob(job.id);
      return jsonResponse({ deleted: true });
    }
    const { conversionStore } =
      await import("../../../../lib/server/conversions/store");
    const store = conversionStore(),
      job = store.cancel((await params).id, owner);
    if (job.status !== "running") await store.remove(job.id);
    return jsonResponse({ deleted: true });
  } catch (error) {
    return conversionFailure(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  let created: string | null = null;
  try {
    verifyOrigin(request);
    if (cloudMode()) {
      requireCloud();
      const store = cloudStore(),
        original = await store.owned((await params).id, session(request).owner);
      if (original.status !== "failed")
        throw new ConversionError("INVALID_OPTIONS");
      const job = await store.reserve(
        createCloudJob(
          original.owner,
          original.operation,
          original.options,
          original.inputs,
        ),
      );
      created = job.id;
      const run = await start(conversionWorkflow, [job.id], {
        experimental_retention: 0,
      });
      await store.setRun(job.id, run.runId);
      await copyInputs(original, job);
      return jsonResponse({ job: publicJob(await store.enqueue(job.id)) }, 202);
    }
    const { conversionStore } =
      await import("../../../../lib/server/conversions/store");
    const store = conversionStore(),
      original = store.owned((await params).id, session(request).owner);
    if (original.status !== "failed")
      throw new ConversionError("INVALID_OPTIONS");
    const capabilities = store.capabilities(),
      engine = conversionSpecs[original.operation].engine;
    if (!capabilities.online) throw new ConversionError("WORKER_OFFLINE");
    if (engine !== "built-in" && !capabilities[engine])
      throw new ConversionError("ENGINE_UNAVAILABLE");
    const job = store.reserve(
      original.owner,
      original.operation,
      original.options,
    );
    created = job.id;
    await mkdir(store.folder(job.id), { recursive: true, mode: 0o700 });
    for (const file of original.inputs)
      await copyFile(
        join(store.folder(original.id), file.filename),
        join(store.folder(job.id), file.filename),
      );
    store.enqueue(job.id, original.inputs);
    return jsonResponse({ job: publicJob(store.get(job.id)!) }, 202);
  } catch (error) {
    if (created) {
      if (cloudMode()) await cloudStore().finish(created, null, "FAILED");
      else {
        const { conversionStore } =
          await import("../../../../lib/server/conversions/store");
        await conversionStore().remove(created);
      }
    }
    return conversionFailure(error);
  }
}
