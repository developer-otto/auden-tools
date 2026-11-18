export const agentTypes = {
  chat: "通用对话",
  auto: "自动分流",
  coding: "编程助手",
  writing: "写作与润色",
  summary: "总结与提炼",
  translation: "翻译",
} as const;
export type AgentType = keyof typeof agentTypes;
export type AgentResponder = Exclude<AgentType, "auto">;

export function isAgentType(value: unknown): value is AgentType {
  return typeof value === "string" && Object.hasOwn(agentTypes, value);
}

export function isAgentResponder(value: unknown): value is AgentResponder {
  return isAgentType(value) && value !== "auto";
}

export const advancedAgentTools = {
  image: "图片生成",
  docs: "OpenAI 文档检索",
  discovery: "按需加载工具",
  programmatic: "批量工具调用",
} as const;
export type AdvancedAgentTool = keyof typeof advancedAgentTools;

export function isAdvancedAgentTool(
  value: unknown,
): value is AdvancedAgentTool {
  return typeof value === "string" && Object.hasOwn(advancedAgentTools, value);
}

export function canEnableAgentTool(
  tool: AdvancedAgentTool,
  model: string,
  siteTools: boolean,
) {
  if (tool === "image" || tool === "docs") return true;
  if (!siteTools) return false;
  const [major, minor] =
    model
      .match(/^gpt-(\d+)(?:\.(\d+))?/)
      ?.slice(1)
      .map(Number) ?? [];
  if (major === undefined) return false;
  return tool === "discovery"
    ? major > 5 || (major === 5 && (minor ?? 0) >= 4)
    : major > 6 || (major === 6 && (minor ?? 0) >= 2);
}

export const builtInAgentModels = [
  "gpt-6.2-astra",
  "gpt-6.2-sol",
  "gpt-6.1-terra",
  "gpt-6.1-sol",
  "gpt-6-luna",
] as const;

export const reasoningLabels = {
  none: "不推理",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
  max: "最高",
} as const;

export type ReasoningEffort = keyof typeof reasoningLabels;
const levels = ["low", "medium", "high", "xhigh", "max"] as const;
const modelEfforts: Readonly<Record<string, readonly ReasoningEffort[]>> = {
  "gpt-6.1-terra": ["none", ...levels],
  "gpt-6.2-astra": levels,
  "gpt-6.2-sol": levels,
  "gpt-6.1-sol": levels,
  "gpt-6-luna": ["none", ...levels],
};

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === "string" && Object.hasOwn(reasoningLabels, value);
}

export function reasoningEfforts(model: string): readonly ReasoningEffort[] {
  return Object.hasOwn(modelEfforts, model) ? modelEfforts[model]! : [];
}
