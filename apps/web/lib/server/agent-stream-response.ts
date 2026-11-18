import {
  agentStreamType,
  type AgentProgress,
  type AgentReply,
  type AgentStreamEvent,
} from "../agent-stream.ts";
import { noStore, upstreamAgentStatus } from "./agent-openai.ts";

export function streamAgentReply(
  requestSignal: AbortSignal,
  run: (
    signal: AbortSignal,
    emit: (event: AgentProgress) => void,
  ) => Promise<AgentReply>,
) {
  const disconnect = new AbortController();
  const signal = AbortSignal.any([requestSignal, disconnect.signal]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: AgentStreamEvent) {
        if (!signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      try {
        const reply = await run(signal, emit);
        emit(
          reply.text || reply.image
            ? { type: "done", reply }
            : { type: "error", status: 502 },
        );
      } catch (error) {
        emit({ type: "error", status: upstreamAgentStatus(error) });
      } finally {
        if (!disconnect.signal.aborted) controller.close();
      }
    },
    cancel() {
      disconnect.abort();
    },
  });
  return new Response(stream, {
    headers: {
      ...noStore,
      "Content-Type": `${agentStreamType}; charset=utf-8`,
      "X-Accel-Buffering": "no",
    },
  });
}
