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

async function traceCapacity(ctx: MutationCtx, ownerId: string, traceId: string) {
  const retained = await ctx.db
    .query("agentModelStepJournal")
    .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", traceId))
    .take(MAX_JOURNAL_STEPS_PER_TRACE);
  if (retained.length >= MAX_JOURNAL_STEPS_PER_TRACE) throw new Error("JOURNAL_STEP_LIMIT_EXCEEDED");
}

export const claim = mutation({
  args: {
    traceId: v.string(),
    stepKey: v.string(),
    inputDigest: v.string(),
    provider: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    nowMs: v.number(),
    leaseMs: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.traceId.length > 100 || args.stepKey.length > 100 || args.model.length > 200) throw new Error("JOURNAL_STRING_LIMIT_EXCEEDED");
    if (!validDigest(args.inputDigest)) throw new Error("JOURNAL_DIGEST_INVALID");
    if (!Number.isFinite(args.nowMs) || !Number.isFinite(args.leaseMs) || args.leaseMs < 1_000 || args.leaseMs > 120_000) throw new Error("JOURNAL_LEASE_INVALID");
    const existing = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", args.traceId).eq("stepKey", args.stepKey))
      .unique();
    if (existing) {
      if (existing.inputDigest !== args.inputDigest) throw new Error("JOURNAL_INPUT_MISMATCH");
      if (existing.responseJson) return { status: "replayed" as const, responseJson: existing.responseJson };
      if ((existing.leaseExpiresAtMs ?? 0) > args.nowMs) return { status: "in_progress" as const };
      await ctx.db.patch(existing._id, { state: "pending", leaseExpiresAtMs: args.nowMs + args.leaseMs });
      return { status: "claimed" as const };
    }
    await traceCapacity(ctx, ownerId, args.traceId);
    await ctx.db.insert("agentModelStepJournal", {
      ownerId,
      traceId: args.traceId,
      stepKey: args.stepKey,
      inputDigest: args.inputDigest,
      provider: args.provider,
      model: args.model,
      state: "pending",
      leaseExpiresAtMs: args.nowMs + args.leaseMs,
      createdAtMs: args.nowMs,
    });
    return { status: "claimed" as const };
  },
});

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
    if (!row?.responseJson || !row.outputDigest) return null;
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
      if (existing.responseJson && existing.outputDigest) {
        return { responseJson: existing.responseJson, outputDigest: existing.outputDigest, replayed: true as const };
      }
      await ctx.db.patch(existing._id, { outputDigest: args.outputDigest, responseJson: args.responseJson, state: "completed", leaseExpiresAtMs: undefined, model: args.model });
    } else {
      await traceCapacity(ctx, ownerId, args.traceId);
      await ctx.db.insert("agentModelStepJournal", { ownerId, ...args, state: "completed" });
    }
    const ownerHistory = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MAX_JOURNAL_STEPS_PER_OWNER + 20);
    for (const expired of ownerHistory.slice(MAX_JOURNAL_STEPS_PER_OWNER)) await ctx.db.delete(expired._id);
    return { responseJson: args.responseJson, outputDigest: args.outputDigest, replayed: false as const };
  },
});

export const release = mutation({
  args: { traceId: v.string(), stepKey: v.string(), inputDigest: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const existing = await ctx.db
      .query("agentModelStepJournal")
      .withIndex("by_owner_trace_step", (q) => q.eq("ownerId", ownerId).eq("traceId", args.traceId).eq("stepKey", args.stepKey))
      .unique();
    if (!existing || existing.responseJson) return { released: false };
    if (existing.inputDigest !== args.inputDigest) throw new Error("JOURNAL_INPUT_MISMATCH");
    await ctx.db.delete(existing._id);
    return { released: true };
  },
});
