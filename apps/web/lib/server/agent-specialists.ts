import type { AssistantMessageItem } from "@openai/agents";
import type OpenAI from "openai";
import type {
  AgentResponder,
  AgentType,
  ReasoningEffort,
} from "../agent-options.ts";
import { collectAgentCitations } from "./agent-citations.ts";

export type AgentTurn = { role: "user" | "assistant"; content: string };

const profiles = {
  chat: "Answer questions directly and clearly.",
  coding:
    "Explain code, diagnose issues, and propose concrete fixes or patches for the user to review.",
  writing:
    "Write or polish the requested text while retaining the intended tone and meaning.",
  summary:
    "Summarize the supplied material, separating key points and action items where useful. Do not invent missing details.",
  translation:
    "Translate the supplied text, preserving its meaning, tone, and formatting. Ask for a target language if it is unclear.",
} satisfies Record<AgentResponder, string>;

const specialties = ["coding", "writing", "summary", "translation"] as const;
const siteToolInstructions =
  "Use the matching Auden tool to calculate dates, convert time zones or units, and convert currencies. Ask if a required date, time zone, amount, or unit is missing. If a local time has two possible results, explain both. For currency conversions, state the published rate date and source. If a tool returns an error or has no data, explain the limitation instead of guessing a result.";

export function agentInstructions(type: AgentResponder, webSearch: boolean) {
  return `You are the Auden Tools assistant. Use the user's language unless another is requested. You cannot access files or execute changes. ${webSearch ? "Use web search when current facts or sources are needed." : "You cannot look up live information."} ${profiles[type]}`;
}

export async function runAgentConversation({
  client,
  model,
  type,
  effort,
  webSearch,
  siteTools,
  turns,
  signal,
}: {
  client: OpenAI;
  model: string;
  type: AgentType;
  effort?: ReasoningEffort;
  webSearch: boolean;
  siteTools: boolean;
  turns: AgentTurn[];
  signal: AbortSignal;
}) {
  const { Agent, OpenAIProvider, Runner, assistant, user, webSearchTool } =
    await import("@openai/agents");
  const tools = siteTools
    ? (await import("./agent-site-tools.ts")).createSiteTools(signal)
    : [];
  const settings = {
    model,
    modelSettings: {
      store: false,
      parallelToolCalls: false,
      ...(effort !== undefined ? { reasoning: { effort } } : {}),
    },
    tools: webSearch ? [webSearchTool(), ...tools] : tools,
  };
  function instructions(profile: AgentResponder) {
    const base = agentInstructions(profile, webSearch);
    return siteTools ? `${base} ${siteToolInstructions}` : base;
  }
  const agent =
    type === "auto"
      ? Agent.create({
          ...settings,
          name: "Auden router",
          instructions: `${instructions("chat")} For coding, writing or editing, summarization, or translation requests, first hand off to the best matching specialist. For general questions, handle the request directly. Use the conversation history to interpret follow-up requests.`,
          handoffs: specialties.map(
            (profile) =>
              new Agent({
                ...settings,
                name: profile,
                instructions: instructions(profile),
                handoffDescription: profiles[profile],
              }),
          ),
        })
      : new Agent({
          ...settings,
          name: type,
          instructions: instructions(type),
        });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient: client,
      useResponses: true,
    }),
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
  });
  const result = await runner.run(
    agent,
    turns.map(({ role, content }) =>
      role === "user" ? user(content) : assistant(content),
    ),
    { maxTurns: siteTools ? 7 : 3, signal },
  );

  const message = result.rawResponses
    .at(-1)
    ?.output.findLast(
      (item): item is AssistantMessageItem =>
        item.type === "message" && "role" in item && item.role === "assistant",
    );
  const parts = message?.content ?? [];
  const text =
    result.finalOutput ||
    parts
      .flatMap((part) => (part.type === "refusal" ? [part.refusal] : []))
      .join("\n");
  const responder =
    specialties.find((type) => type === result.lastAgent?.name) ?? "chat";
  const citations = webSearch
    ? collectAgentCitations(
        parts
          .filter((part) => part.type === "output_text")
          .map((part) => ({
            text: part.text,
            annotations: part.providerData?.annotations,
          })),
      )
    : [];
  return {
    text,
    ...(type === "auto" ? { responder } : {}),
    ...(citations.length ? { citations } : {}),
  };
}
