import { v } from "convex/values";

import { mutation, query, MutationCtx, QueryCtx } from "./server";

const MAX_JOURNAL_STEPS_PER_TRACE = 100;
const MAX_JOURNAL_STEPS_PER_OWNER = 500;
const MAX_JOURNAL_RESPONSE_BYTES = 512 * 1024;

async function authenticatedOwner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

function validDigest(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export const get = query({
  args: {
    traceId: v.string(),
    stepKey: v.string(),
    inputDigest: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const row = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", args.traceId).eq("stepKey", args.stepKey))
      .unique();
    if (!row) return null;
    if (row.inputDigest !== args.inputDigest) throw new Error("JOURNAL_INPUT_MISMATCH");
    return { responseJson: row.responseJson, outputDigest: row.outputDigest, replayed: true as const };
  },
});

export const record = mutation({
  args: {
    traceId: v.string(),
    stepKey: v.string(),
    inputDigest: v.string(),
    outputDigest: v.string(),
    provider: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    responseJson: v.string(),
    createdAtMs: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.traceId.length > 100 || args.stepKey.length > 100 || args.model.length > 200) throw new Error("JOURNAL_STRING_LIMIT_EXCEEDED");
    if (!validDigest(args.inputDigest) || !validDigest(args.outputDigest)) throw new Error("JOURNAL_DIGEST_INVALID");
    if (!Number.isFinite(args.createdAtMs)) throw new Error("JOURNAL_TIME_INVALID");
    if (new TextEncoder().encode(args.responseJson).byteLength > MAX_JOURNAL_RESPONSE_BYTES) throw new Error("JOURNAL_RESPONSE_TOO_LARGE");
    const existing = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", args.traceId).eq("stepKey", args.stepKey))
      .unique();
    if (existing) {
      if (existing.inputDigest !== args.inputDigest) throw new Error("JOURNAL_INPUT_MISMATCH");
      return { responseJson: existing.responseJson, outputDigest: existing.outputDigest, replayed: true as const };
    }
    const retained = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", args.traceId))
      .take(MAX_JOURNAL_STEPS_PER_TRACE);
    if (retained.length >= MAX_JOURNAL_STEPS_PER_TRACE) throw new Error("JOURNAL_STEP_LIMIT_EXCEEDED");
    await ctx.db.insert("agentModelStepJournal", { ownerId, ...args });
    const ownerHistory = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MAX_JOURNAL_STEPS_PER_OWNER + 20);
    for (const expired of ownerHistory.slice(MAX_JOURNAL_STEPS_PER_OWNER)) await ctx.db.delete(expired._id);
    return { responseJson: args.responseJson, outputDigest: args.outputDigest, replayed: false as const };
  },
});
