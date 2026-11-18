import OpenAI from "openai";

export const noStore = { "Cache-Control": "no-store" };

export function agentError(status: number) {
  return Response.json({ error: true }, { status, headers: noStore });
}

export function agentClient(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
  });
}

export function upstreamAgentError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 429)
      return agentError(error.status);
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.code === "model_not_found"
    )
      return agentError(424);
  }
  return agentError(502);
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
