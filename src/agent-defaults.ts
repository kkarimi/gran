import type { GranolaAgentProviderKind } from "./types.ts";

export const defaultGranolaAgentModels: Record<GranolaAgentProviderKind, string> = {
  codex: "gpt-5-codex",
  openai: "gpt-5-mini",
  openrouter: "openai/gpt-5-mini",
};

export function defaultGranolaAgentModel(
  provider: GranolaAgentProviderKind,
  explicitModel?: string,
): string {
  return explicitModel?.trim() || defaultGranolaAgentModels[provider];
}

export function granolaAgentProviderLabel(provider: GranolaAgentProviderKind): string {
  switch (provider) {
    case "codex":
      return "Codex";
    case "openai":
      return "OpenAI";
    case "openrouter":
      return "OpenRouter";
  }
}
