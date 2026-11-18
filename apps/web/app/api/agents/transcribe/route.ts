import {
  agentAudioExtensions,
  maxAgentAudioBytes,
} from "../../../../lib/agent-media.ts";
import {
  agentClient,
  agentError,
  noStore,
  readAgentBytes,
  upstreamAgentError,
} from "../../../../lib/server/agent-openai.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const client = agentClient(request);
  if (!client) return agentError(401);
  const format =
    request.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
  const ext = Object.hasOwn(agentAudioExtensions, format)
    ? agentAudioExtensions[format]
    : undefined;
  if (!ext) return agentError(415);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await readAgentBytes(request, maxAgentAudioBytes);
  } catch (error) {
    return agentError(error instanceof RangeError ? 413 : 400);
  }
  if (!bytes.length) return agentError(400);
  try {
    const { text } = await client.audio.transcriptions.create(
      {
        model: "gpt-transcribe",
        file: new File([bytes], `audio.${ext}`, { type: format }),
      },
      { signal: request.signal },
    );
    return Response.json({ text }, { headers: noStore });
  } catch (error) {
    return upstreamAgentError(error);
  }
}
