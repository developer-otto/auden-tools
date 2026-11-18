import { getAgentConfig } from "../../../lib/server/agent-config.ts";
import {
  agentClient,
  agentError as fail,
  noStore as headers,
  readAgentBytes,
  upstreamAgentError,
} from "../../../lib/server/agent-openai.ts";
import type { AgentCitation } from "../../../lib/agent-media.ts";
import {
  isAgentType,
  isReasoningEffort,
  reasoningEfforts,
  type AgentType,
} from "../../../lib/agent-options.ts";

export const runtime = "nodejs";

const typeInstructions: Record<AgentType, string> = {
  chat: "Answer questions directly and clearly.",
  coding:
    "Explain code, diagnose issues, and propose concrete fixes or patches for the user to review.",
  writing:
    "Write or polish the requested text while retaining the intended tone and meaning.",
  summary:
    "Summarize the supplied material, separating key points and action items where useful. Do not invent missing details.",
  translation:
    "Translate the supplied text, preserving its meaning, tone, and formatting. Ask for a target language if it is unclear.",
};

type Turn = { role: "user" | "assistant"; content: string };

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<Turn>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.trim().length > 0 &&
    turn.content.length <= 8000
  );
}

export async function POST(request: Request) {
  const client = agentClient(request);
  if (!client) return fail(401);

  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder().decode(await readAgentBytes(request, 32_768)),
    );
  } catch {
    return fail(400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail(400);
  const {
    action,
    model,
    type,
    effort,
    webSearch,
    turns: input,
  } = body as Record<string, unknown>;
  const { defaultModel, models } = getAgentConfig();
  if (
    action !== "chat" ||
    (model !== undefined &&
      (typeof model !== "string" || !models.includes(model))) ||
    !isAgentType(type) ||
    (webSearch !== undefined && typeof webSearch !== "boolean")
  )
    return fail(400);

  const selectedModel = model ?? defaultModel;
  if (
    effort !== undefined &&
    (!isReasoningEffort(effort) ||
      !reasoningEfforts(selectedModel).includes(effort))
  )
    return fail(400);

  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > 9 ||
    !input.every(
      (turn, index) =>
        isTurn(turn) && turn.role === (index % 2 ? "assistant" : "user"),
    ) ||
    input.at(-1)?.role !== "user"
  )
    return fail(400);

  try {
    const response = await client.responses.create(
      {
        model: selectedModel,
        ...(effort !== undefined ? { reasoning: { effort } } : {}),
        ...(webSearch ? { tools: [{ type: "web_search" as const }] } : {}),
        instructions: `You are the Auden Tools assistant. Use the user's language unless another is requested. You cannot access files or execute changes. ${webSearch ? "Use web search when current facts or sources are needed." : "You cannot look up live information."} ${typeInstructions[type]}`,
        input: input.map(({ role, content }: Turn) => ({ role, content })),
        store: false,
      },
      { signal: request.signal },
    );

    const text =
      response.output_text ||
      response.output
        .flatMap((item) =>
          item.type === "message"
            ? item.content.flatMap((part) =>
                part.type === "refusal" ? [part.refusal] : [],
              )
            : [],
        )
        .join("\n");
    if (!text) return fail(502);
    const citations: AgentCitation[] = [];
    let offset = 0;
    if (webSearch) {
      for (const item of response.output) {
        if (item.type !== "message") continue;
        for (const part of item.content) {
          if (part.type !== "output_text") continue;
          const length = Array.from(part.text).length;
          for (const citation of part.annotations ?? []) {
            if (citation.type !== "url_citation") continue;
            const url = URL.parse(citation.url);
            if (!url || !["https:", "http:"].includes(url.protocol)) continue;
            if (
              !Number.isInteger(citation.end_index) ||
              citation.end_index < 0 ||
              citation.end_index > length
            )
              continue;
            citations.push({
              end: offset + citation.end_index,
              url: url.href,
              title: citation.title || url.hostname,
            });
          }
          offset += length;
        }
      }
    }
    return Response.json(
      { text, ...(citations.length ? { citations } : {}) },
      { headers },
    );
  } catch (error) {
    return upstreamAgentError(error);
  }
}
