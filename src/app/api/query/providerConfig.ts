export type AgentProvider = "openai" | "openrouter";

export function reasoningConfig(provider: AgentProvider, model: string) {
  if (provider === "openai" && (model === "gpt-5-mini" || model.startsWith("gpt-5-mini-"))) {
    return { reasoning: { effort: "minimal" as const } };
  }
  return {};
}
