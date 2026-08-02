import { boundedExecutionFailureReason, combineObservedUsage } from "./runtimeEvalFailure";

describe("NodeAgent durable execution-failure evidence", () => {
  test("a validation error crossing a runtime boundary keeps its exact bounded reason", () => {
    const crossRealmLikeError = { message: "Agent checkpoint failed validation: create_node requires tempId, parentId, and content." };
    expect(boundedExecutionFailureReason(crossRealmLikeError)).toBe(crossRealmLikeError.message);
    expect(boundedExecutionFailureReason({ message: "x".repeat(1_500) })).toHaveLength(1_000);
    expect(boundedExecutionFailureReason("opaque failure")).toBe("NodeAgent execution failed");
  });

  test("a multi-step failed run reports usage only when every observed provider response reports it", () => {
    expect(combineObservedUsage([])).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
    expect(combineObservedUsage([
      { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    ])).toEqual({ inputTokens: 30, outputTokens: 13, totalTokens: 43 });
    expect(combineObservedUsage([
      { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      { inputTokens: null, outputTokens: 8, totalTokens: null },
    ])).toEqual({ inputTokens: null, outputTokens: 13, totalTokens: null });
  });
});
