import { builtInAgentModels } from "../agent-options.ts";

export function getAgentConfig() {
  const defaultModel =
    process.env.OPENAI_AGENTS_MODEL?.trim() || builtInAgentModels[0];
  const configured = process.env.OPENAI_AGENTS_MODELS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    defaultModel,
    models: [
      ...new Set([
        defaultModel,
        ...(configured?.length ? configured : builtInAgentModels),
      ]),
    ],
  };
}
