import { open } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { ConversionError } from "../../../../../lib/conversions";
import { get } from "@vercel/blob";
import { cloudMode } from "../../../../../lib/server/conversions/cloud/config";
import { cloudStore } from "../../../../../lib/server/conversions/cloud/store";
import {
  session,
  conversionFailure,
} from "../../../../../lib/server/conversions/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (cloudMode()) {
      const job = await cloudStore().owned(
        (await params).id,
        session(request).owner,
      );
      if (job.status !== "succeeded" || !job.output)
        throw new ConversionError("NOT_FOUND");
      const file = await get(job.output.pathname, {
        access: "private",
        useCache: false,
        abortSignal: request.signal,
      });
      if (!file || file.statusCode !== 200)
        throw new ConversionError("NOT_FOUND");
      return new Response(file.stream, {
        headers: downloadHeaders(job.output),
      });
    }
    const { conversionStore } =
      await import("../../../../../lib/server/conversions/store");
    const store = conversionStore(),
      job = store.owned((await params).id, session(request).owner);
    if (job.status !== "succeeded" || !job.output)
      throw new ConversionError("NOT_FOUND");
    const file = await open(
      join(store.folder(job.id), job.output.filename),
      "r",
    ).catch(() => {
      throw new ConversionError("NOT_FOUND");
    });
    // An open descriptor remains readable if the expiry sweeper removes the path.
    const stream = file.createReadStream({
      autoClose: true,
      signal: request.signal,
    });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: downloadHeaders(job.output),
    });
  } catch (error) {
    return conversionFailure(error);
  }
}

function downloadHeaders(output: {
  name: string;
  filename: string;
  mime: string;
  size: number;
}) {
  const encoded = encodeURIComponent(output.name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return {
    "Content-Type": output.mime,
    "Content-Length": String(output.size),
    "Content-Disposition": `attachment; filename="auden-result.${output.filename.split(".").pop()}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}
