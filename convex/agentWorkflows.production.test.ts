/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import parityCorpus from "../evals/nodeagent-notion-parity.json";
import schema from "./schema";
import {
  BENCHMARK_CASE_TIMEOUT_MS,
  BENCHMARK_MAX_OUTPUT_TOKENS,
  NODEAGENT_PARITY_CASES,
  isCertifiedRoute,
  modelFailureTransition,
  rankEvaluations,
  scoreParityResult,
  selectFreeCandidates,
  shouldRunBenchmark,
} from "./modelRouting";

const modules = import.meta.glob("./**/!(*.test).*s");
const recordResult = makeFunctionReference<"mutation", any, any>("agentWorkflows:recordResult");
const transitionProposal = makeFunctionReference<"mutation", any, any>("agentWorkflows:transitionProposal");
const memoryContext = makeFunctionReference<"query", { text: string; limit?: number }, any>(
  "agentWorkflows:memoryContext",
);
const contextSnapshot = makeFunctionReference<
  "query",
  { text: string; mode: "ask" | "agent" | "organize"; limit?: number; rootNodeId?: string },
  any
>("agentWorkflows:contextSnapshot");
const recordRuntimeEvaluation = makeFunctionReference<"mutation", any, any>("agentWorkflows:recordRuntimeEvaluation");
const recentRuntimeEvaluations = makeFunctionReference<"query", { limit?: number }, any>("agentWorkflows:recentRuntimeEvaluations");

const owner = "auth0|nodeagent-memory-owner";

function result(runId: string, status: "completed" | "proposed", mode: "ask" | "agent", proposal = false) {
  const startedAtMs = Date.parse("2026-08-01T00:00:00.000Z") + Number(runId.replace(/\D/g, "") || 0);
  return {
    run: {
      runId,
      status,
      provider: "openai" as const,
      model: "free-eval-model",
      mode,
      query: "Research launch evidence",
      sourceNodeIds: ["evidence-1"],
      sourceBindings: [{ sourceId: "evidence-1", version: 3, digest: "b".repeat(64) }],
      sourceUrls: [],
      proposalId: proposal ? `proposal-${runId}` : undefined,
      summary: `Completed ${runId}`,
      stepCount: 2,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(startedAtMs + 100).toISOString(),
      startedAtMs,
    },
    proposal: proposal ? {
      proposalId: `proposal-${runId}`,
      proposalDigest: "a".repeat(64),
      status: "pending" as const,
      mode: "agent" as const,
      understanding: "Research the evidence.",
      plan: ["Search", "Finish"],
      summary: `Completed ${runId}`,
      operationsJson: "[]",
      sourceBindingsJson: "[]",
      executionMode: "auto" as const,
      riskReasons: [],
      createdAt: new Date(startedAtMs + 100).toISOString(),
      createdAtMs: startedAtMs + 100,
    } : undefined,
    steps: [
      { sequence: 1, tool: "find_nodes", status: "completed" as const, inputDigest: "in", outputDigest: "out", summary: "Found evidence", startedAt: new Date(startedAtMs).toISOString(), completedAt: new Date(startedAtMs + 50).toISOString() },
      { sequence: 2, tool: "finish_work", status: "completed" as const, inputDigest: "in2", outputDigest: "out2", summary: "Finished", startedAt: new Date(startedAtMs + 50).toISOString(), completedAt: new Date(startedAtMs + 100).toISOString() },
    ],
  };
}

describe("NodeAgent typed memory", () => {
  test("a production-shaped Ask receipt persists its exact reviewed source binding", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-bindings` });
    await session.mutation(recordResult, result("binding-1", "completed", "ask"));
    const stored = await session.run(async (ctx) => ctx.db.query("agentRuns").first());
    expect(stored?.sourceBindings).toEqual([
      { sourceId: "evidence-1", version: 3, digest: "b".repeat(64) },
    ]);
  });

  test("an adversarial receipt cannot persist more than 200 source bindings", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-binding-bound` });
    const oversized = result("binding-oversized", "completed", "ask");
    oversized.run.sourceBindings = Array.from({ length: 201 }, (_, index) => ({
      sourceId: `source-${index}`,
      version: 1,
      digest: index.toString(16).padStart(64, "0"),
    }));
    await expect(session.mutation(recordResult, oversized)).rejects.toThrow("SOURCE_BINDING_LIMIT_EXCEEDED");
  });

  test("an applied and a failed research run produce an honest 50% pattern instead of a hardcoded success floor", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: owner });
    await session.mutation(recordResult, result("1", "proposed", "agent", true));
    await session.mutation(transitionProposal, {
      proposalId: "proposal-1", proposalDigest: "a".repeat(64), fromStatus: "pending", toStatus: "accepted", at: "2026-08-01T00:00:01.000Z",
    });
    await session.mutation(transitionProposal, {
      proposalId: "proposal-1", proposalDigest: "a".repeat(64), fromStatus: "accepted", toStatus: "applied", at: "2026-08-01T00:00:02.000Z", appliedUpdatesJson: "[]", inverseUpdatesJson: "[]",
    });
    await session.mutation(recordResult, result("2", "proposed", "agent", true));
    await session.mutation(transitionProposal, {
      proposalId: "proposal-2", proposalDigest: "a".repeat(64), fromStatus: "pending", toStatus: "accepted", at: "2026-08-01T00:00:03.000Z",
    });
    await session.mutation(transitionProposal, {
      proposalId: "proposal-2", proposalDigest: "a".repeat(64), fromStatus: "accepted", toStatus: "failed", at: "2026-08-01T00:00:04.000Z", error: "Graph synchronization failed",
    });

    const memory = await session.query(memoryContext, { text: "launch evidence", limit: 12 });
    expect(memory.memories.map((item: any) => item.outcome).sort()).toEqual(["failure", "success"]);
    expect(memory.patterns[0]).toEqual(expect.objectContaining({
      successCount: 1,
      failureCount: 1,
      successRate: 0.5,
      useCount: 2,
    }));
  });

  test("a sustained 225-run notebook session evicts old unpinned episodes and never exceeds the 200-memory bound", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-sustained` });
    for (let index = 0; index < 225; index += 1) {
      await session.mutation(recordResult, result(`run-${index}`, "completed", "ask"));
    }
    const count = await session.run(async (ctx) => (await ctx.db.query("agentMemories").collect()).length);
    const oldest = await session.run(async (ctx) => ctx.db
      .query("agentMemories")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", `${owner}-sustained`))
      .order("asc")
      .first());
    expect(count).toBe(200);
    expect(oldest?.runId).toBe("run-25");
  });
});

describe("NodeAgent hybrid notebook retrieval", () => {
  test("a researcher starting from a clue receives its semantically sparse graph neighbor with transparent signals", async () => {
    const retrievalOwner = `${owner}-retrieval`;
    const session = convexTest(schema, modules).withIdentity({ subject: retrievalOwner });
    await session.run(async (ctx) => {
      await ctx.db.insert("nodes", {
        ownerId: retrievalOwner, sourceId: "launch-clue", version: 1, isPublic: false,
        contentText: "Launch evidence and customer interview", document: "{\"id\":\"launch-clue\"}", updatedAt: "2026-07-31T00:00:00.000Z",
      });
      await ctx.db.insert("nodes", {
        ownerId: retrievalOwner, sourceId: "hidden-spec", version: 1, isPublic: false,
        contentText: "The decisive constraints live here without repeated keywords", document: "{\"id\":\"hidden-spec\"}", updatedAt: "2026-07-30T00:00:00.000Z",
      });
      await ctx.db.insert("relations", {
        ownerId: retrievalOwner, sourceId: "relation-1", version: 1, isPublic: false,
        document: JSON.stringify({ fromId: "launch-clue", toId: "hidden-spec", relationTypeId: "child" }),
        updatedAt: "2026-07-31T00:00:00.000Z",
      });
    });

    const rows = await session.query(contextSnapshot, {
      text: "launch evidence", mode: "ask", rootNodeId: "launch-clue", limit: 10,
    });
    expect(rows.map((row: any) => row.sourceId)).toContain("hidden-spec");
    expect(rows.find((row: any) => row.sourceId === "launch-clue").retrievalSignals).toContain("current_node");
    expect(rows.find((row: any) => row.sourceId === "hidden-spec").retrievalSignals).toContain("graph_neighbor");
  });

  test("an adversarial cross-owner relation cannot leak another notebook and noisy sustained state stays bounded", async () => {
    const retrievalOwner = `${owner}-isolated`;
    const session = convexTest(schema, modules).withIdentity({ subject: retrievalOwner });
    await session.run(async (ctx) => {
      await ctx.db.insert("nodes", {
        ownerId: retrievalOwner, sourceId: "safe-root", version: 1, isPublic: false,
        contentText: "quarterly planning", document: "{\"id\":\"safe-root\"}", updatedAt: "2026-07-31T00:00:00.000Z",
      });
      await ctx.db.insert("nodes", {
        ownerId: "different-owner", sourceId: "private-node", version: 1, isPublic: false,
        contentText: "quarterly secret", document: "{\"id\":\"private-node\"}", updatedAt: "2026-07-31T00:00:00.000Z",
      });
      await ctx.db.insert("relations", {
        ownerId: retrievalOwner, sourceId: "hostile-relation", version: 1, isPublic: false,
        document: JSON.stringify({ fromId: "safe-root", toId: "private-node" }), updatedAt: "2026-07-31T00:00:00.000Z",
      });
      for (let index = 0; index < 240; index += 1) {
        await ctx.db.insert("nodes", {
          ownerId: retrievalOwner, sourceId: `noise-${index}`, version: 1, isPublic: false,
          contentText: `quarterly noise ${index}`, document: JSON.stringify({ id: `noise-${index}` }),
          updatedAt: "2025-01-01T00:00:00.000Z",
        });
      }
      await ctx.db.insert("relations", {
        ownerId: retrievalOwner, sourceId: "malformed", version: 1, isPublic: false,
        document: "not-json", updatedAt: "2026-07-31T00:00:00.000Z",
      });
    });

    const rows = await session.query(contextSnapshot, {
      text: "quarterly", mode: "ask", rootNodeId: "safe-root", limit: 40,
    });
    expect(rows).toHaveLength(40);
    expect(rows.map((row: any) => row.sourceId)).not.toContain("private-node");
    expect(rows[0].sourceId).toBe("safe-root");
  });
});

describe("NodeAgent automatic free-model routing", () => {
  test("promotion certification covers every locked Notion-authored MewAgent behavior", () => {
    expect(NODEAGENT_PARITY_CASES.map((scenario) => scenario.caseId)).toEqual(
      parityCorpus.cases.map((scenario) => scenario.caseId),
    );
    for (const lockedCase of parityCorpus.cases) {
      if (!("expectedToolOrder" in lockedCase)) continue;
      expect(NODEAGENT_PARITY_CASES.find((scenario) => scenario.caseId === lockedCase.caseId)?.expectedToolOrder)
        .toEqual(lockedCase.expectedToolOrder);
    }
  });

  test("certification scores required tool order, operation shape, and autonomy boundary together", () => {
    const scenario = NODEAGENT_PARITY_CASES[1];
    expect(scoreParityResult(scenario, {
      disposition: "auto_apply",
      toolOrder: ["find_nodes", "run_specialized_workflow", "finish_investigation"],
      operationKinds: ["create_node", "move_node", "move_node", "move_node"],
      selectedNodeIds: ["meeting-1", "meeting-2", "meeting-3"],
    })).toEqual({ passed: true, reasons: [], passedCriteria: 4, totalCriteria: 4 });

    expect(scoreParityResult(scenario, {
      disposition: "auto_apply",
      toolOrder: ["find_nodes", "finish_investigation"],
      operationKinds: ["create_node", "move_node", "move_node"],
      selectedNodeIds: ["meeting-1", "meeting-2"],
    })).toEqual({
      passed: false,
      reasons: ["tool_order", "operation_kinds", "selected_node_ids"],
      passedCriteria: 1,
      totalCriteria: 4,
    });
  });

  test("a catalog refresh admits only free, structured-output, tool-capable candidates and prioritizes new releases", () => {
    const candidates = selectFreeCandidates({ data: [
      { id: "new/free:free", created: 30, context_length: 64_000, supported_parameters: ["tools", "structured_outputs"] },
      { id: "old/free:free", created: 20, context_length: 64_000, supported_parameters: ["tools", "structured_outputs"] },
      { id: "paid/model", created: 40, context_length: 64_000, supported_parameters: ["tools", "structured_outputs"] },
      { id: "no-tools:free", created: 50, context_length: 64_000, supported_parameters: ["structured_outputs"] },
      { id: "tiny:free", created: 60, context_length: 8_000, supported_parameters: ["tools", "structured_outputs"] },
    ] });
    expect(candidates.map((candidate) => candidate.id)).toEqual(["new/free:free", "old/free:free"]);
  });

  test("promotion uses honest scenario scores before latency or novelty", () => {
    const ranked = rankEvaluations([
      { modelId: "fast-but-wrong", catalogCreatedAt: 30, passedCases: 2, totalCases: 3, score: 2 / 3, medianLatencyMs: 100, failureReasons: ["wrong"] },
      { modelId: "reliable", catalogCreatedAt: 20, passedCases: 3, totalCases: 3, score: 1, medianLatencyMs: 900, failureReasons: [] },
      { modelId: "reliable-fast", catalogCreatedAt: 10, passedCases: 3, totalCases: 3, score: 1, medianLatencyMs: 500, failureReasons: [] },
    ]);
    expect(ranked.map((evaluation) => evaluation.modelId)).toEqual(["reliable-fast", "reliable", "fast-but-wrong"]);
  });

  test("catalog polling evaluates new releases, skips an unchanged certified catalog, and failure reruns bypass the skip", () => {
    const certified = { catalogFingerprint: "same", benchmarkVersion: "nodeagent-notion-parity-v3" };
    expect(shouldRunBenchmark("catalog_refresh", "same", certified)).toBe(false);
    expect(shouldRunBenchmark("catalog_refresh", "new", certified)).toBe(true);
    expect(shouldRunBenchmark("failure_threshold", "same", certified)).toBe(true);
    expect(shouldRunBenchmark("manual", "same", certified)).toBe(true);
  });

  test("production routing fails closed when a formerly promoted model has not passed the current parity version", () => {
    expect(isCertifiedRoute({ primaryModel: "old-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notebook-v1" })).toBe(false);
    expect(isCertifiedRoute({ primaryModel: "current-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notion-parity-v3" })).toBe(true);
    expect(isCertifiedRoute({ primaryModel: "failed-free", benchmarkStatus: "failed", benchmarkVersion: "nodeagent-notion-parity-v3" })).toBe(false);
  });

  test("a verbose free model gets the live planner's bounded structured-output budget", () => {
    expect(BENCHMARK_MAX_OUTPUT_TOKENS).toBe(400);
    expect(BENCHMARK_CASE_TIMEOUT_MS).toBe(20_000);
  });

  test("a burst of 25 failed runs schedules exactly one benchmark until that run leaves running state", () => {
    const now = 2 * 60 * 60 * 1_000;
    let consecutiveFailures = 0;
    let benchmarkStatus = "ready";
    let scheduled = 0;
    for (let index = 0; index < 25; index += 1) {
      const transition = modelFailureTransition({ success: false, consecutiveFailures, benchmarkStatus, lastBenchmarkedAtMs: 0, now: now + index });
      consecutiveFailures = transition.consecutiveFailures;
      if (transition.rerunScheduled) {
        scheduled += 1;
        benchmarkStatus = "running";
      }
    }
    expect(consecutiveFailures).toBe(25);
    expect(scheduled).toBe(1);
    expect(modelFailureTransition({ success: true, consecutiveFailures, benchmarkStatus, lastBenchmarkedAtMs: 0, now: now + 30 })).toEqual({ consecutiveFailures: 0, rerunScheduled: false });
  });
});

describe("NodeAgent durable runtime evaluation receipts", () => {
  const evaluation = (index: number): { evaluation: any } => ({
    evaluation: {
      evalId: `eval-${index}`,
      suiteId: "suite-retention",
      caseId: "nodeagent-prompt-injection-boundary",
      benchmarkVersion: "nodeagent-notion-runtime-v1",
      provider: "openrouter" as const,
      model: "free-model",
      mode: "ask" as const,
      disposition: "read_only" as const,
      passed: true,
      reasons: [],
      toolOrder: ["find_nodes", "finish_work"],
      operationKinds: [],
      selectedNodeIds: ["safe-launch"],
      sourceBindings: [{ sourceId: "safe-launch", version: 1, digest: "a".repeat(64) }],
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      latencyMs: 100,
      startedAtMs: index * 1_000,
      completedAtMs: index * 1_000 + 100,
    },
  });

  test("receipts are owner-scoped, replay-safe, and honestly preserve a failed score", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-runtime-evals` });
    const failed = evaluation(1);
    failed.evaluation.passed = false;
    failed.evaluation.disposition = "execution_failed";
    failed.evaluation.reasons = ["checkpoint validation failed"];
    expect(await session.mutation(recordRuntimeEvaluation, failed)).toEqual({ replayed: false, evalId: "eval-1" });
    expect(await session.mutation(recordRuntimeEvaluation, failed)).toEqual({ replayed: true, evalId: "eval-1" });
    const rows = await session.query(recentRuntimeEvaluations, { limit: 20 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ passed: false, disposition: "execution_failed", reasons: ["checkpoint validation failed"] });

    const other = convexTest(schema, modules).withIdentity({ subject: `${owner}-different` });
    expect(await other.query(recentRuntimeEvaluations, { limit: 20 })).toEqual([]);
  });

  test("sustained evaluation history is bounded to the newest 100 receipts", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-runtime-retention` });
    for (let index = 0; index < 121; index += 1) await session.mutation(recordRuntimeEvaluation, evaluation(index));
    const rows = await session.query(recentRuntimeEvaluations, { limit: 100 });
    expect(rows).toHaveLength(100);
    expect(rows[0].evalId).toBe("eval-120");
    expect(rows.at(-1)?.evalId).toBe("eval-21");
  });

  test("adversarial oversized and invalid-digest receipts fail closed", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-runtime-invalid` });
    const oversized = evaluation(1);
    oversized.evaluation.selectedNodeIds = Array.from({ length: 201 }, (_, index) => `node-${index}`);
    await expect(session.mutation(recordRuntimeEvaluation, oversized)).rejects.toThrow("RUNTIME_EVAL_COLLECTION_LIMIT_EXCEEDED");
    const badDigest = evaluation(2);
    badDigest.evaluation.sourceBindings[0].digest = "not-a-digest";
    await expect(session.mutation(recordRuntimeEvaluation, badDigest)).rejects.toThrow("RUNTIME_EVAL_BINDING_INVALID");
    const duplicate = evaluation(3);
    duplicate.evaluation.sourceBindings.push({ ...duplicate.evaluation.sourceBindings[0] });
    await expect(session.mutation(recordRuntimeEvaluation, duplicate)).rejects.toThrow("RUNTIME_EVAL_BINDING_DUPLICATE");
  });
});
