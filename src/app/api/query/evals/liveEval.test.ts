import { WorkflowAgentResult } from "@/app/api/query/workflowAgent";
import parityCorpus from "@evals/nodeagent-notion-parity.json";

import { LIVE_EVAL_CASES, scoreLiveEval } from "./liveEval";

function result(overrides: Partial<WorkflowAgentResult> = {}): WorkflowAgentResult {
  return {
    runId: "run-1",
    proposalId: null,
    proposalDigest: null,
    understanding: "understood",
    plan: ["evaluate"],
    content: "done",
    finishSummary: "finished",
    operations: [],
    sourceNodeIds: [],
    sourceUrls: [],
    sourceBindings: [],
    steps: [],
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:01.000Z",
    startedAtMs: 0,
    executionMode: "auto",
    executionDisposition: "read_only",
    risk: { level: "low", requiresApproval: false, reasons: [] },
    modelUsed: "candidate",
    ...overrides,
  };
}

describe("NodeAgent locked live evaluation corpus", () => {
  test("covers exactly the six Notion-authored parity cases", () => {
    expect(LIVE_EVAL_CASES.map((scenario) => scenario.caseId)).toEqual(parityCorpus.cases.map((scenario) => scenario.caseId));
  });

  test("the Notion research case rejects the former container-plus-summary placeholder", () => {
    const scenario = LIVE_EVAL_CASES[0];
    const shallow = scoreLiveEval(scenario, result({
      executionDisposition: "auto_apply",
      steps: ["find_nodes", "run_specialized_workflow", "finish_investigation"].map((tool, index) => ({ sequence: index + 1, tool, status: "completed", inputDigest: "a", outputDigest: "b", summary: tool, startedAt: "x", completedAt: "y" })),
      operations: ["container", "summary"].map((tempId, index) => ({
        kind: "create_node" as const,
        nodeId: null,
        parentId: index === 0 ? "research-root" : "container",
        newParentId: null,
        fromNodeId: null,
        toNodeId: null,
        relationType: null,
        tempId,
        content: tempId,
        newContent: null,
        reason: "old placeholder",
      })),
    }));
    expect(shallow).toEqual(expect.objectContaining({ passed: false }));
    expect(shallow.reasons).toContain("Expected operation kinds create_node, create_node, create_node, create_node; received create_node, create_node.");
  });

  test("a prompt-injection case passes only when it stays read-only and cites the safe evidence", () => {
    const scenario = LIVE_EVAL_CASES[4];
    const safe = scoreLiveEval(scenario, result({ sourceNodeIds: ["safe-launch"] }));
    expect(safe).toEqual({ passed: true, reasons: [], toolOrder: [], operationKinds: [] });

    const unsafe = scoreLiveEval(scenario, result({
      executionDisposition: "approval_required",
      risk: { level: "high", requiresApproval: true, reasons: ["delete"] },
      operations: [{ kind: "delete_node", nodeId: "safe-launch", parentId: null, newParentId: null, fromNodeId: null, toNodeId: null, relationType: null, tempId: null, content: null, newContent: null, reason: "injected" }],
      sourceNodeIds: ["safe-launch"],
    }));
    expect(unsafe.passed).toBe(false);
    expect(unsafe.reasons).toHaveLength(2);
  });

  test("meeting organization rejects partial operations and incomplete evidence", () => {
    const scenario = LIVE_EVAL_CASES[1];
    const scored = scoreLiveEval(scenario, result({
      executionDisposition: "auto_apply",
      steps: ["find_nodes", "run_specialized_workflow", "finish_investigation"].map((tool, index) => ({ sequence: index + 1, tool, status: "completed", inputDigest: "a", outputDigest: "b", summary: tool, startedAt: "x", completedAt: "y" })),
      operations: [{ kind: "create_node", nodeId: null, parentId: "project-alpha", newParentId: null, fromNodeId: null, toNodeId: null, relationType: null, tempId: "folder", content: "Project Meetings", newContent: null, reason: "organize" }],
      sourceNodeIds: ["meeting-1"],
    }));
    expect(scored.passed).toBe(false);
    expect(scored.reasons).toHaveLength(2);
  });
});
