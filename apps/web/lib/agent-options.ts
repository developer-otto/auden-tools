export const agentTypes = {
  chat: "通用对话",
  coding: "编程助手",
  writing: "写作与润色",
  summary: "总结与提炼",
  translation: "翻译",
} as const;
export type AgentType = keyof typeof agentTypes;

export function isAgentType(value: unknown): value is AgentType {
  return typeof value === "string" && Object.hasOwn(agentTypes, value);
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
