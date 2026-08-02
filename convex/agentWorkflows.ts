import { v } from "convex/values";

import { hydrateNodeDocument } from "./nodeDocuments";
import { mutation, query, QueryCtx, MutationCtx } from "./server";

const MAX_AGENT_RUNS_PER_OWNER = 200;
const MAX_AGENT_STEPS_PER_RUN = 100;
const MAX_RECENT_PROPOSALS = 50;
const MAX_STORED_UPDATE_BYTES = 512 * 1024;
const MAX_AGENT_MEMORIES_PER_OWNER = 200;
const MAX_AGENT_PATTERNS_PER_OWNER = 100;
const MAX_RECALLED_MEMORIES = 12;
const MAX_PATTERN_TOOLS = 12;
const MAX_PINNED_MEMORIES = 20;
const MAX_RETRIEVAL_CANDIDATES = 200;
const MAX_RETRIEVAL_RELATIONS = 1_000;
const MAX_RETRIEVAL_TOKENS = 24;
const MAX_SOURCE_BINDINGS = 200;

function retrievalTokens(value: string) {
  return [...new Set(value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((token) => token.length >= 2))]
    .slice(0, MAX_RETRIEVAL_TOKENS);
}

function lexicalScore(content: string, tokens: string[]) {
  const normalized = content.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function relationEndpoints(document: string) {
  if (document.length > 64 * 1024) return null;
  try {
    const parsed = JSON.parse(document) as { fromId?: unknown; toId?: unknown };
    return typeof parsed.fromId === "string" && typeof parsed.toId === "string"
      ? { fromId: parsed.fromId, toId: parsed.toId }
      : null;
  } catch {
    return null;
  }
}

async function authenticatedOwner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

const runStatus = v.union(
  v.literal("completed"),
  v.literal("failed"),
  v.literal("proposed"),
  v.literal("rejected"),
  v.literal("applied"),
  v.literal("undone"),
);
const workflowMode = v.union(v.literal("agent"), v.literal("organize"));
const proposalStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("applied"),
  v.literal("rejected"),
  v.literal("failed"),
  v.literal("undone"),
);
const stepStatus = v.union(v.literal("completed"), v.literal("failed"), v.literal("repaired"));

function classifyTask(queryText: string) {
  const query = queryText.toLowerCase();
  if (/\b(organize|reorganize|move|triage|folder|hierarch)/.test(query)) return "organize";
  if (/\b(connect|link|relation|related)/.test(query)) return "connect";
  if (/\b(research|investigate|deep dive|compare|profile)/.test(query)) return "research";
  if (/\b(update|edit|revise|rewrite)/.test(query)) return "update";
  if (/\b(create|add|build|draft)/.test(query)) return "create";
  if (/\b(find|search|locate|which notes)/.test(query)) return "retrieve";
  return "answer";
}

function patternId(taskClass: string, toolSequence: string[]) {
  return `${taskClass}:${toolSequence.slice(0, MAX_PATTERN_TOOLS).join(">").slice(0, 400)}`;
}

async function pruneTypedMemory(ctx: MutationCtx, ownerId: string) {
  const memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(MAX_AGENT_MEMORIES_PER_OWNER + 20);
  for (const memory of memories.slice(MAX_AGENT_MEMORIES_PER_OWNER)) {
    if (!memory.pinned) await ctx.db.delete(memory._id);
  }
  const patterns = await ctx.db
    .query("agentPatterns")
    .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(MAX_AGENT_PATTERNS_PER_OWNER + 20);
  for (const pattern of patterns.slice(MAX_AGENT_PATTERNS_PER_OWNER)) await ctx.db.delete(pattern._id);
}

async function recordTerminalMemory(
  ctx: MutationCtx,
  ownerId: string,
  run: {
    runId: string;
    query: string;
    summary?: string;
    sourceNodeIds: string[];
    startedAtMs: number;
    completedAt: string;
  },
  outcome: "success" | "failure" | "rejected" | "undone",
) {
  const existing = await ctx.db
    .query("agentMemories")
    .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", run.runId))
    .unique();
  if (existing) {
    if (existing.outcome === "success" && outcome === "undone") {
      await ctx.db.patch(existing._id, { outcome: "undone", lastUsedAtMs: Date.now() });
      const id = patternId(existing.taskClass, existing.toolSequence);
      const pattern = await ctx.db
        .query("agentPatterns")
        .withIndex("by_owner_pattern", (q) => q.eq("ownerId", ownerId).eq("patternId", id))
        .unique();
      if (pattern) {
        await ctx.db.patch(pattern._id, {
          successCount: Math.max(0, pattern.successCount - 1),
          totalDurationMs: Math.max(0, pattern.totalDurationMs - existing.durationMs),
          useCount: Math.max(0, pattern.useCount - 1),
          updatedAtMs: Date.now(),
        });
      }
    }
    return;
  }
  const steps = await ctx.db
    .query("agentSteps")
    .withIndex("by_owner_run_sequence", (q) => q.eq("ownerId", ownerId).eq("runId", run.runId))
    .order("asc")
    .take(MAX_AGENT_STEPS_PER_RUN);
  const toolSequence = steps.map((step) => step.tool).slice(0, MAX_PATTERN_TOOLS);
  const taskClass = classifyTask(run.query);
  const completedAtMs = Date.parse(run.completedAt);
  const safeCompletedAtMs = Number.isFinite(completedAtMs) ? completedAtMs : Date.now();
  const durationMs = Math.max(0, safeCompletedAtMs - run.startedAtMs);
  await ctx.db.insert("agentMemories", {
    ownerId,
    memoryId: `run:${run.runId}`,
    runId: run.runId,
    taskClass,
    summary: (run.summary || `${outcome}: ${run.query}`).slice(0, 2_000),
    query: run.query.slice(0, 2_000),
    toolSequence,
    sourceNodeIds: run.sourceNodeIds.slice(0, 200),
    outcome,
    durationMs,
    pinned: false,
    createdAt: run.completedAt,
    createdAtMs: safeCompletedAtMs,
    lastUsedAtMs: safeCompletedAtMs,
  });
  if (outcome === "success" || outcome === "failure") {
    const id = patternId(taskClass, toolSequence);
    const existingPattern = await ctx.db
      .query("agentPatterns")
      .withIndex("by_owner_pattern", (q) => q.eq("ownerId", ownerId).eq("patternId", id))
      .unique();
    if (existingPattern) {
      await ctx.db.patch(existingPattern._id, {
        successCount: existingPattern.successCount + (outcome === "success" ? 1 : 0),
        failureCount: existingPattern.failureCount + (outcome === "failure" ? 1 : 0),
        totalDurationMs: existingPattern.totalDurationMs + durationMs,
        useCount: existingPattern.useCount + 1,
        updatedAtMs: safeCompletedAtMs,
      });
    } else {
      await ctx.db.insert("agentPatterns", {
        ownerId,
        patternId: id,
        taskClass,
        toolSequence,
        successCount: outcome === "success" ? 1 : 0,
        failureCount: outcome === "failure" ? 1 : 0,
        totalDurationMs: durationMs,
        useCount: 1,
        updatedAtMs: safeCompletedAtMs,
      });
    }
  }
  await pruneTypedMemory(ctx, ownerId);
}

const runArgs = {
  runId: v.string(),
  status: runStatus,
  provider: v.union(v.literal("openai"), v.literal("openrouter")),
  model: v.string(),
  mode: v.union(v.literal("ask"), workflowMode),
  query: v.string(),
  sourceNodeIds: v.array(v.string()),
  sourceBindings: v.optional(v.array(v.object({
    sourceId: v.string(),
    version: v.number(),
    digest: v.string(),
  }))),
  sourceUrls: v.array(v.string()),
  proposalId: v.optional(v.string()),
  summary: v.string(),
  stepCount: v.number(),
  inputTokens: v.union(v.number(), v.null()),
  outputTokens: v.union(v.number(), v.null()),
  totalTokens: v.union(v.number(), v.null()),
  error: v.optional(v.string()),
  startedAt: v.string(),
  completedAt: v.string(),
  startedAtMs: v.number(),
};

const stepArgs = v.object({
  sequence: v.number(),
  tool: v.string(),
  status: stepStatus,
  inputDigest: v.string(),
  outputDigest: v.string(),
  summary: v.string(),
  startedAt: v.string(),
  completedAt: v.string(),
});

async function pruneOwnerHistory(ctx: MutationCtx, ownerId: string) {
  const retained = await ctx.db
    .query("agentRuns")
    .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(MAX_AGENT_RUNS_PER_OWNER + 20);
  for (const expired of retained.slice(MAX_AGENT_RUNS_PER_OWNER)) {
    const proposals = await ctx.db
      .query("agentProposals")
      .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", expired.runId))
      .take(10);
    for (const proposal of proposals) await ctx.db.delete(proposal._id);
    const steps = await ctx.db
      .query("agentSteps")
      .withIndex("by_owner_run_sequence", (q) => q.eq("ownerId", ownerId).eq("runId", expired.runId))
      .take(MAX_AGENT_STEPS_PER_RUN + 1);
    for (const step of steps) await ctx.db.delete(step._id);
    await ctx.db.delete(expired._id);
  }
}

export const recordResult = mutation({
  args: {
    run: v.object(runArgs),
    proposal: v.optional(v.object({
      proposalId: v.string(),
      proposalDigest: v.string(),
      status: v.literal("pending"),
      mode: workflowMode,
      understanding: v.string(),
      plan: v.array(v.string()),
      summary: v.string(),
      operationsJson: v.string(),
      sourceBindingsJson: v.string(),
      executionMode: v.optional(v.union(v.literal("auto"), v.literal("plan"))),
      riskReasons: v.optional(v.array(v.string())),
      createdAt: v.string(),
      createdAtMs: v.number(),
    })),
    steps: v.array(stepArgs),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.steps.length > MAX_AGENT_STEPS_PER_RUN) throw new Error("AGENT_STEP_LIMIT_EXCEEDED");
    const sourceBindings = args.run.sourceBindings ?? [];
    if (sourceBindings.length > MAX_SOURCE_BINDINGS) throw new Error("SOURCE_BINDING_LIMIT_EXCEEDED");
    if (new Set(sourceBindings.map((binding) => binding.sourceId)).size !== sourceBindings.length) {
      throw new Error("SOURCE_BINDING_DUPLICATE");
    }
    if (sourceBindings.some((binding) => !Number.isInteger(binding.version)
      || binding.version < 0
      || !/^[a-f0-9]{64}$/i.test(binding.digest))) {
      throw new Error("SOURCE_BINDING_INVALID");
    }
    if (args.proposal && args.run.proposalId !== args.proposal.proposalId) {
      throw new Error("PROPOSAL_ID_MISMATCH");
    }
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", args.run.runId))
      .unique();
    if (existing) return { replayed: true, runId: existing.runId };

    await ctx.db.insert("agentRuns", { ownerId, ...args.run });
    if (args.proposal) {
      await ctx.db.insert("agentProposals", { ownerId, runId: args.run.runId, ...args.proposal });
    }
    for (const step of args.steps) {
      await ctx.db.insert("agentSteps", { ownerId, runId: args.run.runId, ...step });
    }
    if (!args.proposal && args.run.status === "completed") {
      await recordTerminalMemory(ctx, ownerId, args.run, "success");
    }
    await pruneOwnerHistory(ctx, ownerId);
    return { replayed: false, runId: args.run.runId };
  },
});

export const getProposal = query({
  args: { proposalId: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const proposal = await ctx.db
      .query("agentProposals")
      .withIndex("by_owner_proposal", (q) => q.eq("ownerId", ownerId).eq("proposalId", args.proposalId))
      .unique();
    if (!proposal) return null;
    const steps = await ctx.db
      .query("agentSteps")
      .withIndex("by_owner_run_sequence", (q) => q.eq("ownerId", ownerId).eq("runId", proposal.runId))
      .order("asc")
      .take(MAX_AGENT_STEPS_PER_RUN);
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", proposal.runId))
      .unique();
    return { proposal, run, steps };
  },
});

export const recentProposals = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), MAX_RECENT_PROPOSALS);
    return await ctx.db
      .query("agentProposals")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(limit);
  },
});

export const memoryContext = query({
  args: { text: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 8), 1), MAX_RECALLED_MEMORIES);
    const searchText = args.text.trim().slice(0, 512);
    const matched = searchText.length >= 3
      ? await ctx.db
        .query("agentMemories")
        .withSearchIndex("search_summary_owner", (q) => q.search("summary", searchText).eq("ownerId", ownerId))
        .take(limit)
      : [];
    const recent = await ctx.db
      .query("agentMemories")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(limit);
    const memories = [...new Map([...matched, ...recent].map((memory) => [memory.memoryId, memory])).values()]
      .slice(0, limit)
      .map((memory) => ({
        memoryId: memory.memoryId,
        taskClass: memory.taskClass,
        summary: memory.summary,
        toolSequence: memory.toolSequence,
        outcome: memory.outcome,
        sourceNodeIds: memory.sourceNodeIds,
        pinned: memory.pinned,
      }));
    const patterns = await ctx.db
      .query("agentPatterns")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(8);
    return {
      memories,
      patterns: patterns.map((pattern) => ({
        taskClass: pattern.taskClass,
        toolSequence: pattern.toolSequence,
        successCount: pattern.successCount,
        failureCount: pattern.failureCount,
        successRate: pattern.useCount ? pattern.successCount / pattern.useCount : 0,
        averageDurationMs: pattern.useCount ? pattern.totalDurationMs / pattern.useCount : 0,
        useCount: pattern.useCount,
      })),
    };
  },
});

export const updateMemory = mutation({
  args: {
    memoryId: v.string(),
    action: v.union(v.literal("pin"), v.literal("unpin"), v.literal("forget")),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const memory = await ctx.db
      .query("agentMemories")
      .withIndex("by_owner_memory", (q) => q.eq("ownerId", ownerId).eq("memoryId", args.memoryId))
      .unique();
    if (!memory) throw new Error("MEMORY_NOT_FOUND");
    if (args.action === "forget") {
      await ctx.db.delete(memory._id);
      return { status: "forgotten" };
    }
    if (args.action === "pin" && !memory.pinned) {
      const pinned = await ctx.db
        .query("agentMemories")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .filter((q) => q.eq(q.field("pinned"), true))
        .take(MAX_PINNED_MEMORIES);
      if (pinned.length >= MAX_PINNED_MEMORIES) throw new Error("PINNED_MEMORY_LIMIT_EXCEEDED");
    }
    await ctx.db.patch(memory._id, { pinned: args.action === "pin", lastUsedAtMs: Date.now() });
    return { status: args.action === "pin" ? "pinned" : "unpinned" };
  },
});

export const contextSnapshot = query({
  args: {
    text: v.string(),
    mode: v.union(v.literal("ask"), workflowMode),
    limit: v.optional(v.number()),
    rootNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), args.mode === "organize" ? 200 : 40);
    const queryTokens = retrievalTokens(args.text);
    const matched = args.text.trim().length >= 3
      ? await ctx.db
        .query("nodes")
        .withSearchIndex("search_content_owner", (q) =>
          q.search("contentText", args.text.trim()).eq("ownerId", ownerId),
        )
        .take(Math.min(limit, 40))
      : [];
    const candidates = await ctx.db
      .query("nodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(MAX_RETRIEVAL_CANDIDATES);
    const bySourceId = new Map([...matched, ...candidates].map((node) => [node.sourceId, node]));
    if (args.rootNodeId && !bySourceId.has(args.rootNodeId)) {
      const root = await ctx.db
        .query("nodes")
        .withIndex("by_owner_source", (q) => q.eq("ownerId", ownerId).eq("sourceId", args.rootNodeId!))
        .unique();
      if (root) bySourceId.set(root.sourceId, root);
    }

    const signals = new Map<string, Set<string>>();
    const addSignal = (sourceId: string, signal: string) => {
      const existing = signals.get(sourceId) ?? new Set<string>();
      existing.add(signal);
      signals.set(sourceId, existing);
    };
    matched.forEach((node) => addSignal(node.sourceId, "full_text"));
    if (args.rootNodeId && bySourceId.has(args.rootNodeId)) addSignal(args.rootNodeId, "current_node");
    for (const node of candidates) {
      if (lexicalScore(node.contentText ?? "", queryTokens) > 0) addSignal(node.sourceId, "lexical");
    }

    const graphSeeds = new Set<string>([
      ...matched.slice(0, 20).map((node) => node.sourceId),
      ...(args.rootNodeId ? [args.rootNodeId] : []),
    ]);
    if (graphSeeds.size > 0) {
      const relations = await ctx.db
        .query("relations")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(MAX_RETRIEVAL_RELATIONS);
      const neighborIds = new Set<string>();
      for (const relation of relations) {
        const endpoints = relationEndpoints(relation.document);
        if (!endpoints) continue;
        if (graphSeeds.has(endpoints.fromId)) neighborIds.add(endpoints.toId);
        if (graphSeeds.has(endpoints.toId)) neighborIds.add(endpoints.fromId);
        if (neighborIds.size >= 80) break;
      }
      for (const sourceId of neighborIds) {
        let node = bySourceId.get(sourceId);
        if (!node) {
          node = await ctx.db
            .query("nodes")
            .withIndex("by_owner_source", (q) => q.eq("ownerId", ownerId).eq("sourceId", sourceId))
            .unique() ?? undefined;
          if (node) bySourceId.set(sourceId, node);
        }
        if (node) addSignal(sourceId, "graph_neighbor");
      }
    }

    const matchedRank = new Map(matched.map((node, index) => [node.sourceId, matched.length - index]));
    const ranked = [...bySourceId.values()]
      .map((node) => {
        const nodeSignals = signals.get(node.sourceId) ?? new Set<string>();
        const lexical = lexicalScore(node.contentText ?? "", queryTokens);
        const updatedAtMs = Date.parse(node.updatedAt);
        const recency = Number.isFinite(updatedAtMs) ? Math.max(0, 1 - ((Date.now() - updatedAtMs) / 86_400_000 / 365)) : 0;
        if (recency > 0) nodeSignals.add("recent");
        return {
          node,
          retrievalSignals: [...nodeSignals].sort(),
          score: (matchedRank.get(node.sourceId) ?? 0) * 100
            + lexical * 10
            + (nodeSignals.has("current_node") ? 50 : 0)
            + (nodeSignals.has("graph_neighbor") ? 25 : 0)
            + recency,
        };
      })
      .filter(({ score }) => args.mode === "organize" || score > 0)
      .sort((a, b) => b.score - a.score || b.node.updatedAt.localeCompare(a.node.updatedAt) || a.node.sourceId.localeCompare(b.node.sourceId))
      .slice(0, limit);
    return Promise.all(
      ranked.map(async ({ node, retrievalSignals }) => ({
        sourceId: node.sourceId,
        version: node.version,
        contentText: node.contentText ?? "",
        document: await hydrateNodeDocument(ctx, node),
        updatedAt: node.updatedAt,
        retrievalSignals,
      })),
    );
  },
});

export const bindingSnapshot = query({
  args: { sourceIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.sourceIds.length > 200) throw new Error("SOURCE_BINDING_LIMIT_EXCEEDED");
    const rows = [];
    for (const sourceId of [...new Set(args.sourceIds)]) {
      const node = await ctx.db
        .query("nodes")
        .withIndex("by_owner_source", (q) => q.eq("ownerId", ownerId).eq("sourceId", sourceId))
        .unique();
      if (node) {
        rows.push({
          sourceId: node.sourceId,
          version: node.version,
          contentText: node.contentText ?? "",
          document: await hydrateNodeDocument(ctx, node),
          updatedAt: node.updatedAt,
        });
      }
    }
    return rows;
  },
});

const allowedTransitions: Record<string, string[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["applied", "failed"],
  applied: ["undone"],
  rejected: [],
  failed: [],
  undone: [],
};

export const transitionProposal = mutation({
  args: {
    proposalId: v.string(),
    proposalDigest: v.string(),
    fromStatus: proposalStatus,
    toStatus: proposalStatus,
    at: v.string(),
    appliedUpdatesJson: v.optional(v.string()),
    inverseUpdatesJson: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const proposal = await ctx.db
      .query("agentProposals")
      .withIndex("by_owner_proposal", (q) => q.eq("ownerId", ownerId).eq("proposalId", args.proposalId))
      .unique();
    if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
    if (proposal.proposalDigest !== args.proposalDigest) throw new Error("PROPOSAL_DIGEST_MISMATCH");
    if (proposal.status !== args.fromStatus) throw new Error(`PROPOSAL_STATE_CONFLICT:${proposal.status}`);
    if (!allowedTransitions[proposal.status]?.includes(args.toStatus)) {
      throw new Error(`INVALID_PROPOSAL_TRANSITION:${proposal.status}->${args.toStatus}`);
    }
    const updateBytes =
      (args.appliedUpdatesJson?.length ?? 0) + (args.inverseUpdatesJson?.length ?? 0);
    if (updateBytes > MAX_STORED_UPDATE_BYTES) throw new Error("PROPOSAL_UPDATE_PAYLOAD_TOO_LARGE");

    await ctx.db.patch(proposal._id, {
      status: args.toStatus,
      decisionAt: ["accepted", "rejected"].includes(args.toStatus) ? args.at : proposal.decisionAt,
      appliedAt: ["applied", "undone"].includes(args.toStatus) ? args.at : proposal.appliedAt,
      appliedUpdatesJson: args.appliedUpdatesJson ?? proposal.appliedUpdatesJson,
      inverseUpdatesJson: args.inverseUpdatesJson ?? proposal.inverseUpdatesJson,
      error: args.error?.slice(0, 500),
    });
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", proposal.runId))
      .unique();
    if (run && ["rejected", "applied", "failed", "undone"].includes(args.toStatus)) {
      await ctx.db.patch(run._id, { status: args.toStatus as "rejected" | "applied" | "failed" | "undone" });
      const outcome: "success" | "failure" | "rejected" | "undone" = args.toStatus === "applied"
        ? "success"
        : args.toStatus === "failed"
          ? "failure"
          : args.toStatus === "rejected"
            ? "rejected"
            : "undone";
      await recordTerminalMemory(ctx, ownerId, { ...run, completedAt: args.at }, outcome);
    }
    return { status: args.toStatus };
  },
});
