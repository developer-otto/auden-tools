import type { AgentCitation } from "./agent-media.ts";
import type { AgentResponder } from "./agent-options.ts";

export const agentStreamType = "application/x-ndjson";

export type AgentReply = {
  text: string;
  citations?: AgentCitation[];
  responder?: AgentResponder;
  image?: string;
};

export type AgentProgress =
  | { type: "delta"; text: string }
  | { type: "specialist"; responder: AgentResponder }
  | { type: "tool" };

export type AgentStreamEvent =
  | AgentProgress
  | { type: "done"; reply: AgentReply }
  | { type: "error"; status: number };

export async function readAgentStream(
  response: Response,
  onProgress: (event: AgentProgress) => void,
): Promise<Extract<AgentStreamEvent, { type: "done" | "error" }>> {
  if (!response.headers.get("Content-Type")?.includes(agentStreamType)) {
    return { type: "done", reply: (await response.json()) as AgentReply };
  }
  if (!response.body) throw new Error("Missing agent stream");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Agent stream ended without a reply");
      buffer += value;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const event = JSON.parse(buffer.slice(0, newline)) as AgentStreamEvent;
        buffer = buffer.slice(newline + 1);
        if (event.type === "done" || event.type === "error") return event;
        onProgress(event);
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
