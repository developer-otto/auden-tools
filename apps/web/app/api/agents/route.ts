import { getAgentConfig } from "../../../lib/server/agent-config.ts";
import {
  agentClient,
  agentError as fail,
  noStore as headers,
  readAgentBytes,
  upstreamAgentError,
} from "../../../lib/server/agent-openai.ts";
import { collectAgentCitations } from "../../../lib/server/agent-citations.ts";
import {
  maxAttachedAgentRequestBytes,
  maxAgentRequestBytes,
} from "../../../lib/agent-attachments.ts";
import { readAgentAttachment } from "../../../lib/server/agent-attachments.ts";
import { agentStreamType } from "../../../lib/agent-stream.ts";
import { streamAgentReply } from "../../../lib/server/agent-stream-response.ts";
import {
  agentInstructions,
  runAgentConversation,
  type AgentTurn,
} from "../../../lib/server/agent-specialists.ts";
import {
  canEnableAgentTool,
  isAdvancedAgentTool,
  isAgentType,
  isReasoningEffort,
  reasoningEfforts,
} from "../../../lib/agent-options.ts";

export const runtime = "nodejs";

function isTurn(value: unknown): value is AgentTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<AgentTurn>;
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
  let size: number;
  try {
    const bytes = await readAgentBytes(request, maxAttachedAgentRequestBytes);
    size = bytes.byteLength;
    body = JSON.parse(new TextDecoder().decode(bytes));
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
    siteTools,
    advancedTools = [],
    attachment: incomingAttachment,
    turns: input,
  } = body as Record<string, unknown>;
  const { defaultModel, models } = getAgentConfig();
  if (
    action !== "chat" ||
    (model !== undefined &&
      (typeof model !== "string" || !models.includes(model))) ||
    !isAgentType(type) ||
    (webSearch !== undefined && typeof webSearch !== "boolean") ||
    (siteTools !== undefined && typeof siteTools !== "boolean") ||
    !Array.isArray(advancedTools) ||
    advancedTools.length > 4 ||
    !advancedTools.every(isAdvancedAgentTool) ||
    new Set(advancedTools).size !== advancedTools.length
  )
    return fail(400);

  const selectedModel = model ?? defaultModel;
  if (
    !advancedTools.every((tool) =>
      canEnableAgentTool(tool, selectedModel, siteTools === true),
    )
  )
    return fail(424);
  const attachment =
    incomingAttachment === undefined
      ? undefined
      : readAgentAttachment(incomingAttachment);
  if (
    attachment === null ||
    size - (attachment?.data.length ?? 0) > maxAgentRequestBytes
  )
    return fail(400);
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
    const turns = input.map(({ role, content }: AgentTurn) => ({
      role,
      content,
    }));
    const conversation = {
      client,
      model: selectedModel,
      type,
      effort,
      webSearch: webSearch === true,
      siteTools: siteTools === true,
      advancedTools,
      attachment,
      turns,
    };
    if (request.headers.get("Accept") === agentStreamType) {
      return streamAgentReply(request.signal, (signal, emit) =>
        runAgentConversation({ ...conversation, signal, emit }),
      );
    }
    if (
      type === "auto" ||
      siteTools === true ||
      advancedTools.length ||
      attachment
    ) {
      const reply = await runAgentConversation({
        ...conversation,
        signal: request.signal,
      });
      return reply.text || reply.image
        ? Response.json(reply, { headers })
        : fail(502);
    }

    const response = await client.responses.create(
      {
        model: selectedModel,
        ...(effort !== undefined ? { reasoning: { effort } } : {}),
        ...(webSearch ? { tools: [{ type: "web_search" as const }] } : {}),
        instructions: agentInstructions(type, webSearch === true),
        input: turns,
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
    const citations = webSearch
      ? collectAgentCitations(
          response.output.flatMap((item) =>
            item.type === "message"
              ? item.content.filter((part) => part.type === "output_text")
              : [],
          ),
        )
      : [];
    return Response.json(
      { text, ...(citations.length ? { citations } : {}) },
      { headers },
    );
  } catch (error) {
    return upstreamAgentError(error);
  }
}
