import {
  latestSuiteReceipts,
  runRuntimeEvalCases,
  runtimeCaseStatus,
  runtimeEvalSummary,
  selectFailedCases,
  selectRemainingCases,
  RuntimeEvalCase,
  RuntimeEvalReceipt,
} from "./runtimeVerificationState";

const cases: RuntimeEvalCase[] = [
  { caseId: "research", title: "Research" },
  { caseId: "organize", title: "Organize" },
  { caseId: "injection", title: "Injection" },
];

function receipt(caseId: string, passed = true, suiteId = "suite-current"): RuntimeEvalReceipt {
  return {
    evalId: `eval-${caseId}-${passed}`,
    suiteId,
    caseId,
    benchmarkVersion: "runtime-v1",
    provider: "openai",
    model: "gpt-test",
    disposition: caseId === "injection" ? "read_only" : "auto_apply",
    passed,
    reasons: passed ? [] : ["operation_kinds"],
    toolOrder: ["find_nodes", "finish_work"],
    operationKinds: [],
    selectedNodeIds: [],
    sourceBindings: [],
    proposalDigest: null,
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    latencyMs: 100,
    startedAtMs: 1,
    completedAtMs: 101,
    persisted: true,
    graphMutated: false,
  };
}

describe("NodeAgent runtime verification UI state", () => {
  test("a returning owner restores only the newest durable suite and newest receipt per case", () => {
    const restored = latestSuiteReceipts([
      receipt("research", false),
      receipt("research", true),
      receipt("organize", true),
      receipt("injection", true, "suite-old"),
    ]);
    expect(restored.suiteId).toBe("suite-current");
    expect(restored.receipts.map((item) => [item.caseId, item.passed])).toEqual([
      ["research", false],
      ["organize", true],
    ]);
  });

  test("empty and populated summaries never invent scores or token usage", () => {
    expect(runtimeEvalSummary([], 3)).toEqual({ completed: 0, passed: 0, failed: 0, remaining: 3, latencyMs: 0, totalTokens: null });
    const unknownUsage = { ...receipt("research"), usage: { inputTokens: null, outputTokens: null, totalTokens: null } };
    expect(runtimeEvalSummary([unknownUsage, receipt("organize", false)], 3)).toMatchObject({ completed: 2, passed: 1, failed: 1, remaining: 1, totalTokens: null });
  });

  test("the synapse map reports only active work or durable receipt state", () => {
    const receipts = [receipt("research"), receipt("organize", false)];
    expect(runtimeCaseStatus("injection", receipts, null)).toBe("idle");
    expect(runtimeCaseStatus("research", receipts, null)).toBe("passed");
    expect(runtimeCaseStatus("organize", receipts, null)).toBe("failed");
    expect(runtimeCaseStatus("organize", receipts, "organize")).toBe("running");
  });

  test("a cautious owner can stop after the current case and keep its durable receipt", async () => {
    let stop = false;
    const persisted: RuntimeEvalReceipt[] = [];
    const started: string[] = [];
    const outcome = await runRuntimeEvalCases({
      cases,
      suiteId: "suite-stop",
      fetchCase: async (caseId) => {
        stop = true;
        return receipt(caseId, true, "suite-stop");
      },
      shouldStop: () => stop,
      onCaseStart: (testCase) => started.push(testCase.caseId),
      onReceipt: (value) => persisted.push(value),
    });
    expect(outcome.stopped).toBe(true);
    expect(started).toEqual(["research"]);
    expect(persisted.map((item) => item.caseId)).toEqual(["research"]);
  });

  test("a provider failure preserves earlier receipts and remaining/retry selection is exact", async () => {
    const persisted: RuntimeEvalReceipt[] = [];
    await expect(runRuntimeEvalCases({
      cases,
      suiteId: "suite-failure",
      fetchCase: async (caseId) => {
        if (caseId === "organize") throw new Error("provider timeout");
        return receipt(caseId, true, "suite-failure");
      },
      shouldStop: () => false,
      onCaseStart: () => undefined,
      onReceipt: (value) => persisted.push(value),
    })).rejects.toThrow("provider timeout");
    expect(persisted.map((item) => item.caseId)).toEqual(["research"]);
    expect(selectRemainingCases(cases, persisted).map((item) => item.caseId)).toEqual(["organize", "injection"]);
    expect(selectFailedCases(cases, [receipt("organize", false)]).map((item) => item.caseId)).toEqual(["organize"]);
  });
});
