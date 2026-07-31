import { v } from "convex/values";

import { hydrateNodeDocument } from "./nodeDocuments";
import { mutation, query, QueryCtx, MutationCtx } from "./server";

const MAX_AGENT_RUNS_PER_OWNER = 200;
const MAX_AGENT_STEPS_PER_RUN = 100;
const MAX_RECENT_PROPOSALS = 50;
const MAX_STORED_UPDATE_BYTES = 512 * 1024;

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

const runArgs = {
  runId: v.string(),
  status: runStatus,
  provider: v.literal("openai"),
  model: v.string(),
  mode: v.union(v.literal("ask"), workflowMode),
  query: v.string(),
  sourceNodeIds: v.array(v.string()),
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
      createdAt: v.string(),
      createdAtMs: v.number(),
    })),
    steps: v.array(stepArgs),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.steps.length > MAX_AGENT_STEPS_PER_RUN) throw new Error("AGENT_STEP_LIMIT_EXCEEDED");
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

export const contextSnapshot = query({
  args: {
    text: v.string(),
    mode: v.union(v.literal("ask"), workflowMode),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), args.mode === "organize" ? 200 : 40);
    const matched = args.text.trim().length >= 3
      ? await ctx.db
        .query("nodes")
        .withSearchIndex("search_content_owner", (q) =>
          q.search("contentText", args.text.trim()).eq("ownerId", ownerId),
        )
        .take(Math.min(limit, 40))
      : [];
    const indexed = args.mode === "organize"
      ? await ctx.db.query("nodes").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(limit)
      : [];
    const deduped = new Map([...matched, ...indexed].map((node) => [node.sourceId, node]));
    return Promise.all(
      [...deduped.values()].slice(0, limit).map(async (node) => ({
        sourceId: node.sourceId,
        version: node.version,
        contentText: node.contentText ?? "",
        document: await hydrateNodeDocument(ctx, node),
        updatedAt: node.updatedAt,
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
    if (run && ["rejected", "applied", "undone"].includes(args.toStatus)) {
      await ctx.db.patch(run._id, { status: args.toStatus as "rejected" | "applied" | "undone" });
    }
    return { status: args.toStatus };
  },
});
