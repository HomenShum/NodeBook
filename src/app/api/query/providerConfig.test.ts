import { reasoningConfig } from "./providerConfig";

describe("NodeAgent production model latency policy", () => {
  it("uses minimal reasoning for the paid GPT-5 mini fallback without changing other providers or model families", () => {
    expect(reasoningConfig("openai", "gpt-5-mini")).toEqual({ reasoning: { effort: "minimal" } });
    expect(reasoningConfig("openai", "gpt-5-mini-2025-08-07")).toEqual({ reasoning: { effort: "minimal" } });
    expect(reasoningConfig("openai", "gpt-5-mini", true)).toEqual({ reasoning: { effort: "low" } });
    expect(reasoningConfig("openai", "gpt-4.1-mini")).toEqual({});
    expect(reasoningConfig("openrouter", "gpt-5-mini")).toEqual({});
  });
});
