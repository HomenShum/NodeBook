/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import parityCorpus from "../evals/nodeagent-notion-parity.json";
import schema from "./schema";
import {
  NODEAGENT_PARITY_CASES,
  isCertifiedRoute,
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
    })).toEqual({ passed: true, reasons: [] });

    expect(scoreParityResult(scenario, {
      disposition: "auto_apply",
      toolOrder: ["find_nodes", "finish_investigation"],
      operationKinds: ["create_node", "move_node", "move_node"],
      selectedNodeIds: ["meeting-1", "meeting-2"],
    })).toEqual({
      passed: false,
      reasons: ["tool_order", "operation_kinds", "selected_node_ids"],
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
    const certified = { catalogFingerprint: "same", benchmarkVersion: "nodeagent-notion-parity-v2" };
    expect(shouldRunBenchmark("catalog_refresh", "same", certified)).toBe(false);
    expect(shouldRunBenchmark("catalog_refresh", "new", certified)).toBe(true);
    expect(shouldRunBenchmark("failure_threshold", "same", certified)).toBe(true);
    expect(shouldRunBenchmark("manual", "same", certified)).toBe(true);
  });

  test("production routing fails closed when a formerly promoted model has not passed the current parity version", () => {
    expect(isCertifiedRoute({ primaryModel: "old-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notebook-v1" })).toBe(false);
    expect(isCertifiedRoute({ primaryModel: "current-free", benchmarkStatus: "ready", benchmarkVersion: "nodeagent-notion-parity-v2" })).toBe(true);
    expect(isCertifiedRoute({ primaryModel: "failed-free", benchmarkStatus: "failed", benchmarkVersion: "nodeagent-notion-parity-v2" })).toBe(false);
  });
});
