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
const memoryDetail = makeFunctionReference<"query", { memoryId: string }, any>("agentWorkflows:memoryDetail");
const updateMemory = makeFunctionReference<"mutation", { memoryId: string; action: "pin" | "unpin" | "forget" }, any>("agentWorkflows:updateMemory");
const contextSnapshot = makeFunctionReference<
  "query",
  { text: string; mode: "ask" | "agent" | "organize"; limit?: number; rootNodeId?: string },
  any
>("agentWorkflows:contextSnapshot");
const recordRuntimeEvaluation = makeFunctionReference<"mutation", any, any>("agentWorkflows:recordRuntimeEvaluation");
const recentRuntimeEvaluations = makeFunctionReference<"query", { limit?: number }, any>("agentWorkflows:recentRuntimeEvaluations");
const getJournalStep = makeFunctionReference<"query", any, any>("agentStepJournal:get");
const recordJournalStep = makeFunctionReference<"mutation", any, any>("agentStepJournal:record");

const owner = "auth0|nodeagent-memory-owner";

function result(
  runId: string,
  status: "completed" | "proposed",
  mode: "ask" | "agent",
  proposal = false,
  provider: "openai" | "nodebook" = "openai",
  memoryEligible: boolean | undefined = undefined,
) {
  const startedAtMs = Date.parse("2026-08-01T00:00:00.000Z") + Number(runId.replace(/\D/g, "") || 0);
  return {
    run: {
      runId,
      traceId: runId,
      status,
      provider,
      model: "free-eval-model",
      mode,
      query: "Research launch evidence",
      sourceNodeIds: ["evidence-1"],
      sourceBindings: [{ sourceId: "evidence-1", version: 3, digest: "b".repeat(64) }],
      sourceUrls: [],
      proposalId: proposal ? `proposal-${runId}` : undefined,
      memoryEligible,
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
  test("a production-shaped Ask receipt persists one trace spine with its exact reviewed source binding", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-bindings` });
    await session.mutation(recordResult, result("binding-1", "completed", "ask"));
    const stored = await session.run(async (ctx) => ({
      run: await ctx.db.query("agentRuns").first(),
      steps: await ctx.db.query("agentSteps").collect(),
      memory: await ctx.db.query("agentMemories").first(),
    }));
    expect(stored.run?.sourceBindings).toEqual([
      { sourceId: "evidence-1", version: 3, digest: "b".repeat(64) },
    ]);
    expect(stored.run?.traceId).toBe("binding-1");
    expect(stored.steps.map((step) => step.traceId)).toEqual(["binding-1", "binding-1"]);
    expect(stored.memory?.traceId).toBe("binding-1");
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

  test("an adversarial caller cannot split one run across a different trace identity", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-trace-mismatch` });
    const mismatched = result("trace-run", "completed", "ask");
    mismatched.run.traceId = "different-trace";
    await expect(session.mutation(recordResult, mismatched)).rejects.toThrow("TRACE_ID_RUN_ID_MISMATCH");
  });

  test("a failed trace can retry into one clean durable result without duplicate steps or proposals", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-failed-retry` });
    const failed: any = result("retry-1", "completed", "ask");
    failed.run.status = "failed";
    failed.run.error = "provider timeout";
    failed.run.summary = "failed";
    failed.steps = [];
    await session.mutation(recordResult, failed);
    await session.mutation(recordResult, result("retry-1", "completed", "ask"));
    const stored = await session.run(async (ctx) => ({
      runs: await ctx.db.query("agentRuns").collect(),
      steps: await ctx.db.query("agentSteps").collect(),
    }));
    expect(stored.runs).toHaveLength(1);
    expect(stored.runs[0]).toMatchObject({ status: "completed", traceId: "retry-1" });
    expect(stored.runs[0].error).toBeUndefined();
    expect(stored.steps).toHaveLength(2);
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

  test("an owner can inspect provenance while another owner cannot read the same typed memory", async () => {
    const database = convexTest(schema, modules);
    const ownerSession = database.withIdentity({ subject: `${owner}-inspect` });
    const otherSession = database.withIdentity({ subject: `${owner}-other` });
    await ownerSession.mutation(recordResult, result("inspect-1", "completed", "ask"));

    await expect(ownerSession.query(memoryDetail, { memoryId: "run:inspect-1" })).resolves.toEqual(expect.objectContaining({
      query: "Research launch evidence",
      durationMs: 100,
      sourceNodeIds: ["evidence-1"],
      createdAt: expect.any(String),
    }));
    await expect(otherSession.query(memoryDetail, { memoryId: "run:inspect-1" })).resolves.toBeNull();
  });

  test("an internal checkpointed projection does not recursively create another learned memory", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-projection` });
    const projection = result("projection-1", "proposed", "agent", true, "nodebook", false);
    await session.mutation(recordResult, projection);
    await session.mutation(transitionProposal, {
      proposalId: "proposal-projection-1", proposalDigest: "a".repeat(64), fromStatus: "pending", toStatus: "accepted", at: "2026-08-02T00:00:01.000Z",
    });
    await session.mutation(transitionProposal, {
      proposalId: "proposal-projection-1", proposalDigest: "a".repeat(64), fromStatus: "accepted", toStatus: "applied", at: "2026-08-02T00:00:02.000Z", appliedUpdatesJson: "[]", inverseUpdatesJson: "[]",
    });

    const memories = await session.run(async (ctx) => ctx.db.query("agentMemories").collect());
    expect(memories).toEqual([]);
  });

  test("a user can inspect, pin, unpin, and forget one memory without affecting another owner", async () => {
    const database = convexTest(schema, modules);
    const ownerSession = database.withIdentity({ subject: `${owner}-controls` });
    const otherSession = database.withIdentity({ subject: `${owner}-controls-other` });
    await ownerSession.mutation(recordResult, result("controls-1", "completed", "ask"));

    await expect(ownerSession.mutation(updateMemory, { memoryId: "run:controls-1", action: "pin" }))
      .resolves.toEqual({ status: "pinned" });
    await expect(ownerSession.query(memoryDetail, { memoryId: "run:controls-1" }))
      .resolves.toEqual(expect.objectContaining({ pinned: true }));
    await expect(otherSession.mutation(updateMemory, { memoryId: "run:controls-1", action: "forget" }))
      .rejects.toThrow("MEMORY_NOT_FOUND");
    await expect(ownerSession.mutation(updateMemory, { memoryId: "run:controls-1", action: "unpin" }))
      .resolves.toEqual({ status: "unpinned" });
    await expect(ownerSession.mutation(updateMemory, { memoryId: "run:controls-1", action: "forget" }))
      .resolves.toEqual({ status: "forgotten" });
    await expect(ownerSession.query(memoryDetail, { memoryId: "run:controls-1" })).resolves.toBeNull();
  });

  test("a concurrent pin burst preserves the 20-memory cap", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-pin-burst` });
    for (let index = 0; index < 21; index += 1) {
      await session.mutation(recordResult, result(`pin-${index}`, "completed", "ask"));
    }
    const outcomes = await Promise.allSettled(Array.from({ length: 21 }, (_, index) => session.mutation(updateMemory, {
      memoryId: `run:pin-${index}`,
      action: "pin",
    })));
    const pinned = await session.run(async (ctx) => (await ctx.db.query("agentMemories").collect()).filter((item) => item.pinned));

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(20);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(pinned).toHaveLength(20);
  });

  test("a sustained 225-run notebook session evicts old unpinned episodes and never exceeds the 200-memory bound", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-sustained` });
    for (let index = 0; index < 225; index += 1) {
      await session.mutation(recordResult, result(`run-${index}`, "completed", "ask"));
    }
    const retained = await session.run(async (ctx) => ({
      memories: await ctx.db.query("agentMemories").collect(),
      runs: await ctx.db.query("agentRuns").collect(),
      oldestMemory: await ctx.db
        .query("agentMemories")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", `${owner}-sustained`))
        .order("asc")
        .first(),
      oldestRun: await ctx.db
        .query("agentRuns")
        .withIndex("by_owner_started", (q) => q.eq("ownerId", `${owner}-sustained`))
        .order("asc")
        .first(),
    }));
    expect(retained.memories).toHaveLength(200);
    expect(retained.runs).toHaveLength(200);
    expect(retained.oldestMemory?.runId).toBe("run-25");
    expect(retained.oldestRun?.runId).toBe("run-25");
  }, 15_000);
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

  test("the current research benchmark rejects a model that still emits the old two-node placeholder", () => {
    const scenario = NODEAGENT_PARITY_CASES[0];
    expect(scoreParityResult(scenario, {
      disposition: "auto_apply",
      toolOrder: ["find_nodes", "run_specialized_workflow", "finish_investigation"],
      operationKinds: ["create_node", "create_node"],
      selectedNodeIds: [],
      workProductCount: 2,
    })).toEqual(expect.objectContaining({
      passed: false,
      reasons: ["operation_kinds", "work_product_count"],
    }));
    expect(scoreParityResult(scenario, {
      disposition: "auto_apply",
      toolOrder: ["find_nodes", "run_specialized_workflow", "finish_investigation"],
      operationKinds: ["create_node", "create_node", "create_node", "create_node"],
      selectedNodeIds: [],
      workProductCount: 3,
    })).toEqual({ passed: true, reasons: [], passedCriteria: 4, totalCriteria: 4 });
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
    const certified = { catalogFingerprint: "same", benchmarkVersion: "nodeagent-notion-parity-v4" };
    expect(shouldRunBenchmark("catalog_refresh", "same", certified)).toBe(false);
    expect(shouldRunBenchmark("catalog_refresh", "new", certified)).toBe(true);
    expect(shouldRunBenchmark("failure_threshold", "same", certified)).toBe(true);
    expect(shouldRunBenchmark("manual", "same", certified)).toBe(true);
  });

  test("production routing fails closed when a formerly promoted model has not passed the current parity version", () => {
    expect(isCertifiedRoute({ primaryModel: "old-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notebook-v1" })).toBe(false);
    expect(isCertifiedRoute({ primaryModel: "current-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notion-parity-v4" })).toBe(true);
    expect(isCertifiedRoute({ primaryModel: "failed-free", benchmarkStatus: "failed", benchmarkVersion: "nodeagent-notion-parity-v4" })).toBe(false);
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
      traceId: `trace-${index}`,
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
    expect(rows[0]).toMatchObject({ traceId: "trace-1", passed: false, disposition: "execution_failed", reasons: ["checkpoint validation failed"] });

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

describe("NodeAgent exactly-once provider journal", () => {
  const entry = (step: number) => ({
    traceId: "trace-journal",
    stepKey: step.toString(16).padStart(64, "0"),
    inputDigest: step.toString(16).padStart(64, "0"),
    outputDigest: (step + 1).toString(16).padStart(64, "0"),
    provider: "openai" as const,
    model: "gpt-test",
    responseJson: JSON.stringify({ result: { step }, sources: [], usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, actualModel: "gpt-test" }),
    createdAtMs: step,
  });

  test("one owner replays the first completed step while another owner cannot observe it", async () => {
    const database = convexTest(schema, modules);
    const session = database.withIdentity({ subject: `${owner}-journal` });
    const other = database.withIdentity({ subject: `${owner}-journal-other` });
    const first = entry(1);
    expect(await session.mutation(recordJournalStep, first)).toMatchObject({ replayed: false, responseJson: first.responseJson });
    expect(await session.mutation(recordJournalStep, { ...first, responseJson: entry(2).responseJson, outputDigest: entry(2).outputDigest }))
      .toMatchObject({ replayed: true, responseJson: first.responseJson });
    expect(await session.query(getJournalStep, { traceId: first.traceId, stepKey: first.stepKey, inputDigest: first.inputDigest }))
      .toMatchObject({ replayed: true, responseJson: first.responseJson });
    expect(await other.query(getJournalStep, { traceId: first.traceId, stepKey: first.stepKey, inputDigest: first.inputDigest })).toBeNull();
  });

  test("a sustained trace cannot grow beyond 100 provider steps", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-journal-bound` });
    for (let step = 0; step < 100; step += 1) await session.mutation(recordJournalStep, entry(step));
    await expect(session.mutation(recordJournalStep, entry(100))).rejects.toThrow("JOURNAL_STEP_LIMIT_EXCEEDED");
  });

  test("sustained retry history evicts old provider receipts at the 500-step owner bound", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: `${owner}-journal-owner-bound` });
    for (let step = 0; step < 520; step += 1) {
      await session.mutation(recordJournalStep, { ...entry(step), traceId: `trace-${Math.floor(step / 100)}` });
    }
    const rows = await session.run(async (ctx) => ctx.db.query("agentModelStepJournal").collect());
    expect(rows).toHaveLength(500);
    expect(Math.min(...rows.map((row) => row.createdAtMs))).toBe(20);
  });
});
