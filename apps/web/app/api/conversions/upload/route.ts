import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { ConversionError } from "../../../../lib/conversions";
import { requireCloud } from "../../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../../lib/server/conversions/cloud/store";
import {
  jobPrefix,
  uploadGrant,
} from "../../../../lib/server/conversions/cloud/model";
import {
  session,
  verifyOrigin,
  readJson,
  jsonResponse,
  conversionFailure,
} from "../../../../lib/server/conversions/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireCloud();
    const body = (await readJson(request)) as HandleUploadBody;
    if (
      !body ||
      !["blob.generate-client-token", "blob.upload-completed"].includes(
        body.type,
      )
    )
      throw new ConversionError("INVALID_OPTIONS");
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        verifyOrigin(request);
        if (!clientPayload) throw new ConversionError("FORBIDDEN");
        const job = await cloudStore().owned(
          clientPayload,
          session(request).owner,
        );
        return uploadGrant(job, pathname, session(request).owner);
      },
      // The SDK verifies the Blob signature before invoking this callback.
      // Do not require browser cookies/origin on a service-to-service webhook.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload || !blob.pathname.startsWith(jobPrefix(tokenPayload)))
          throw new ConversionError("FORBIDDEN");
        const job = await cloudStore().get(tokenPayload);
        if (
          !job ||
          job.hidden ||
          job.expiresAt <= Date.now() ||
          !job.inputs.some((input) => input.pathname === blob.pathname)
        )
          await del(blob.pathname);
      },
    });
    return jsonResponse(result);
  } catch (error) {
    return conversionFailure(error);
  }
}
