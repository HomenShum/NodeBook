export type AgentProvider = "openai" | "openrouter";

export function reasoningConfig(provider: AgentProvider, model: string, webResearch = false) {
  if (provider === "openai" && (model === "gpt-5-mini" || model.startsWith("gpt-5-mini-"))) {
    return { reasoning: { effort: webResearch ? "low" as const : "minimal" as const } };
  }
  return {};
}
