import { createHash, randomBytes } from "node:crypto";
import { ConversionError } from "../../conversions.ts";
import { conversionConfig } from "./config.ts";

const COOKIE = "auden-files";
export function session(request: Request, create = false) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const valid = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : null;
  const token = valid || (create ? randomBytes(32).toString("hex") : null);
  return {
    owner: token ? createHash("sha256").update(token).digest("hex") : null,
    cookie:
      !valid && token
        ? `${COOKIE}=${token}; Path=/api/conversions; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(request.url).protocol === "https:" || conversionConfig().publicOrigin?.startsWith("https:") ? "; Secure" : ""}`
        : null,
  };
}
export function verifyOrigin(request: Request) {
  const expected =
    conversionConfig().publicOrigin || new URL(request.url).origin;
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ConversionError("FORBIDDEN");
}
export function jsonResponse(
  value: unknown,
  status = 200,
  cookie: string | null = null,
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(value, { status, headers });
}
export function conversionFailure(error: unknown) {
  const code = error instanceof ConversionError ? error.code : "FAILED";
  const status =
    code === "NOT_FOUND"
      ? 404
      : code === "FORBIDDEN"
        ? 403
        : ["BUSY", "RATE_LIMIT"].includes(code)
          ? 429
          : ["WORKER_OFFLINE", "ENGINE_UNAVAILABLE"].includes(code)
            ? 503
            : code === "FILE_TOO_LARGE"
              ? 413
              : code === "FAILED"
                ? 500
                : 400;
  return jsonResponse({ error: code }, status);
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ConversionError("INVALID_OPTIONS");
  const reader = request.body?.getReader();
  if (!reader) throw new ConversionError("INVALID_OPTIONS");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new ConversionError("INVALID_OPTIONS");
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError("INVALID_OPTIONS");
  } finally {
    reader.releaseLock();
  }
}
