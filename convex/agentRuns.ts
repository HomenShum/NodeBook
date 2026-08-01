import { v } from "convex/values";

import { mutation, query, QueryCtx, MutationCtx } from "./server";

const MAX_AGENT_RUNS_PER_OWNER = 200;
const MAX_RECENT_AGENT_RUNS = 50;

async function authenticatedOwner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

const runArgs = {
  runId: v.string(),
  status: v.union(
    v.literal("completed"),
    v.literal("failed"),
    v.literal("proposed"),
    v.literal("rejected"),
    v.literal("applied"),
    v.literal("undone"),
  ),
    provider: v.union(v.literal("openai"), v.literal("openrouter")),
  model: v.string(),
  mode: v.union(v.literal("read-only"), v.literal("ask"), v.literal("agent"), v.literal("organize")),
  query: v.string(),
  sourceNodeIds: v.array(v.string()),
  sourceUrls: v.optional(v.array(v.string())),
  proposalId: v.optional(v.string()),
  summary: v.optional(v.string()),
  stepCount: v.optional(v.number()),
  inputTokens: v.union(v.number(), v.null()),
  outputTokens: v.union(v.number(), v.null()),
  totalTokens: v.union(v.number(), v.null()),
  error: v.optional(v.string()),
  startedAt: v.string(),
  completedAt: v.string(),
  startedAtMs: v.number(),
};

export const record = mutation({
  args: runArgs,
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_run", (q) => q.eq("ownerId", ownerId).eq("runId", args.runId))
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert("agentRuns", { ownerId, ...args });
    const retained = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MAX_AGENT_RUNS_PER_OWNER + 1);
    for (const expired of retained.slice(MAX_AGENT_RUNS_PER_OWNER)) await ctx.db.delete(expired._id);
    return id;
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), MAX_RECENT_AGENT_RUNS);
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(limit);
  },
});
