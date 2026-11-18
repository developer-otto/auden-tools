import { timingSafeEqual } from "node:crypto";
import OpenAI from "openai";

export const noStore = { "Cache-Control": "no-store" };

export function agentError(status: number) {
  return Response.json({ error: true }, { status, headers: noStore });
}

export function agentClient(request: Request) {
  const access = request.headers.get("x-agents-access-code")?.trim();
  if (!access || access.length > 1024) return null;
  const sharedCode = process.env.AUDEN_AGENTS_ACCESS_CODE?.trim();
  const serverKey = process.env.OPENAI_API_KEY?.trim();
  const provided = Buffer.from(access);
  const expected = Buffer.from(sharedCode ?? "");
  const isShared =
    serverKey &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);
  return new OpenAI({ apiKey: isShared ? serverKey : access });
}

export function upstreamAgentStatus(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 429) return error.status;
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.code === "model_not_found"
    )
      return 424;
  }
  return 502;
}

export function upstreamAgentError(error: unknown) {
  return agentError(upstreamAgentStatus(error));
}

export async function readAgentBytes(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty request");
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}
