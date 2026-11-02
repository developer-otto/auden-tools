import { timingSafeEqual } from "node:crypto";
import { cloudMode } from "../../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../../lib/server/conversions/cloud/store";
import { cleanupJob } from "../../../../lib/server/conversions/cloud/lifecycle";
import {
  jsonResponse,
  conversionFailure,
} from "../../../../lib/server/conversions/http";
import { ConversionError } from "../../../../lib/conversions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET,
      auth = request.headers.get("authorization") || "";
    const expected = `Bearer ${secret || ""}`;
    if (
      !secret ||
      Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    )
      throw new ConversionError("FORBIDDEN");
    if (!cloudMode()) return jsonResponse({ cleaned: 0 });
    const store = cloudStore(),
      jobs = await store.expired();
    let cleaned = 0;
    for (const job of jobs) {
      await cleanupJob(job.id);
      cleaned++;
    }
    await store.pruneQuota();
    return jsonResponse({ cleaned });
  } catch (error) {
    return conversionFailure(error);
  }
}
