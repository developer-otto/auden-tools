import { ConversionError } from "../../../../../lib/conversions";
import { requireCloud } from "../../../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../../../lib/server/conversions/cloud/store";
import { publicJob } from "../../../../../lib/server/conversions/cloud/model";
import { verifyUploads } from "../../../../../lib/server/conversions/cloud/blob";
import {
  session,
  verifyOrigin,
  jsonResponse,
  conversionFailure,
} from "../../../../../lib/server/conversions/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyOrigin(request);
    requireCloud();
    const store = cloudStore(),
      job = await store.owned((await params).id, session(request).owner);
    if (job.status === "uploading") {
      if (Date.now() >= job.uploadDeadline)
        throw new ConversionError("UPLOAD_TIMEOUT");
      await verifyUploads(job);
    }
    return jsonResponse({ job: publicJob(await store.enqueue(job.id)) }, 202);
  } catch (error) {
    return conversionFailure(error);
  }
}
