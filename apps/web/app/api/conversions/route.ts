import {
  ConversionError,
  isConversionId,
  conversionSpecs,
  validateOptions,
} from "../../../lib/conversions";
import { start } from "workflow/api";
import { conversionWorkflow } from "../../../workflows/conversion";
import {
  cloudMode,
  cloudCapabilities,
  requireCloud,
} from "../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../lib/server/conversions/cloud/store";
import {
  createCloudJob,
  parseManifest,
  publicJob,
} from "../../../lib/server/conversions/cloud/model";
import {
  session,
  verifyOrigin,
  jsonResponse,
  conversionFailure,
  readJson,
} from "../../../lib/server/conversions/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const auth = session(request, true);
    if (cloudMode()) {
      const capabilities = cloudCapabilities();
      return jsonResponse(
        {
          capabilities,
          jobs: capabilities.online ? await cloudStore().list(auth.owner!) : [],
        },
        200,
        auth.cookie,
      );
    }
    const { conversionStore } =
      await import("../../../lib/server/conversions/store");
    const store = conversionStore();
    return jsonResponse(
      {
        capabilities: { ...store.capabilities(), upload: "local" },
        jobs: store.list(auth.owner!),
      },
      200,
      auth.cookie,
    );
  } catch (error) {
    return conversionFailure(error);
  }
}
export async function POST(request: Request) {
  let id: string | null = null;
  try {
    verifyOrigin(request);
    if (cloudMode()) {
      requireCloud();
      const { operation, options, files } = parseManifest(
        await readJson(request),
      );
      const auth = session(request, true),
        store = cloudStore();
      const job = await store.reserve(
        createCloudJob(auth.owner!, operation, options, files),
      );
      id = job.id;
      // Schedule expiry before granting any upload capability. No after()/fire-and-forget.
      const run = await start(conversionWorkflow, [job.id], {
        experimental_retention: 0,
      });
      await store.setRun(job.id, run.runId);
      return jsonResponse(
        {
          job: publicJob(job),
          uploads: job.inputs.map(({ pathname }) => ({ pathname })),
        },
        201,
        auth.cookie,
      );
    }
    const { conversionStore } =
      await import("../../../lib/server/conversions/store");
    const { uploadFiles } =
      await import("../../../lib/server/conversions/upload");
    const url = new URL(request.url),
      operation = url.searchParams.get("operation") || "";
    if (!isConversionId(operation))
      throw new ConversionError("INVALID_OPTIONS");
    let raw: unknown;
    try {
      raw = JSON.parse(url.searchParams.get("options") || "{}");
    } catch {
      throw new ConversionError("INVALID_OPTIONS");
    }
    const options = validateOptions(raw),
      store = conversionStore(),
      capabilities = store.capabilities();
    if (!capabilities.online) throw new ConversionError("WORKER_OFFLINE");
    const engine = conversionSpecs[operation].engine;
    if (engine !== "built-in" && !capabilities[engine])
      throw new ConversionError("ENGINE_UNAVAILABLE");
    const auth = session(request, true),
      job = store.reserve(auth.owner!, operation, options);
    id = job.id;
    const inputs = await uploadFiles(request, job, store);
    store.enqueue(job.id, inputs);
    return jsonResponse(
      { job: publicJob(store.get(job.id)!) },
      202,
      auth.cookie,
    );
  } catch (error) {
    if (id) {
      if (cloudMode()) await cloudStore().finish(id, null, "FAILED");
      else {
        const { conversionStore } =
          await import("../../../lib/server/conversions/store");
        await conversionStore().remove(id);
      }
    }
    return conversionFailure(error);
  }
}
