import { maxAgentSpeechChars } from "../../../../lib/agent-media.ts";
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
  let input: string;
  try {
    input = new TextDecoder()
      .decode(await readAgentBytes(request, maxAgentSpeechChars * 4))
      .trim();
  } catch (error) {
    return agentError(error instanceof RangeError ? 413 : 400);
  }
  if (!input || input.length > maxAgentSpeechChars) return agentError(400);
  try {
    const speech = await client.audio.speech.create(
      {
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input,
        response_format: "mp3",
      },
      { signal: request.signal },
    );
    return new Response(speech.body, {
      headers: { ...noStore, "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    return upstreamAgentError(error);
  }
}
