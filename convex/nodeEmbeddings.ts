import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { hydrateNodeDocument } from "./nodeDocuments";
import { action, ActionCtx, internalQuery, mutation, MutationCtx, query, QueryCtx } from "./server";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const MAX_EMBEDDING_WORK = 24;
const MAX_EMBEDDING_SCAN = 512;
const MAX_EMBEDDING_INPUT_CHARS = 4_000;
const MIN_SEMANTIC_SCORE = 0.2;

type EmbeddingWorkItem = {
  sourceId: string;
  version: number;
  contentText: string;
};

async function authenticatedOwner(ctx: ActionCtx | MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

export function validateEmbeddingVector(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("INVALID_EMBEDDING_VECTOR");
  }
  return embedding;
}

export const embeddingWork = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<EmbeddingWorkItem[]> => {
    const ownerId = await authenticatedOwner(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? MAX_EMBEDDING_WORK), 1), MAX_EMBEDDING_WORK);
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(MAX_EMBEDDING_SCAN);
    return nodes
      .filter((node) => (node.contentText?.trim().length ?? 0) >= 3)
      .filter((node) => node.embeddingVersion !== node.version || node.embeddingModel !== EMBEDDING_MODEL)
      .slice(0, limit)
      .map((node) => ({
        sourceId: node.sourceId,
        version: node.version,
        contentText: node.contentText!.slice(0, MAX_EMBEDDING_INPUT_CHARS),
      }));
  },
});

export const storeEmbeddings = mutation({
  args: {
    items: v.array(v.object({
      sourceId: v.string(),
      version: v.number(),
      embedding: v.array(v.float64()),
    })),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    if (args.items.length > MAX_EMBEDDING_WORK) throw new Error("EMBEDDING_BATCH_LIMIT_EXCEEDED");
    let stored = 0;
    for (const item of args.items) {
      validateEmbeddingVector(item.embedding);
      const node = await ctx.db
        .query("nodes")
        .withIndex("by_owner_source", (q) => q.eq("ownerId", ownerId).eq("sourceId", item.sourceId))
        .unique();
      if (!node || node.version !== item.version) continue;
      await ctx.db.patch(node._id, {
        embedding: item.embedding,
        embeddingVersion: item.version,
        embeddingModel: EMBEDDING_MODEL,
        embeddingUpdatedAtMs: Date.now(),
      });
      stored += 1;
    }
    return { stored };
  },
});

export const hydrateSemanticMatches = internalQuery({
  args: {
    ownerId: v.string(),
    matches: v.array(v.object({ nodeId: v.id("nodes"), score: v.number() })),
  },
  handler: async (ctx, args) => {
    const rows = [];
    for (const match of args.matches.slice(0, 40)) {
      const node = await ctx.db.get(match.nodeId);
      if (!node || node.ownerId !== args.ownerId || node.embeddingVersion !== node.version) continue;
      rows.push({
        sourceId: node.sourceId,
        version: node.version,
        contentText: node.contentText ?? "",
        document: await hydrateNodeDocument(ctx, node),
        updatedAt: node.updatedAt,
        retrievalSignals: ["semantic"],
        semanticScore: match.score,
      });
    }
    return rows;
  },
});

const hydrateSemanticMatchesReference = makeFunctionReference<"query", any, any>(
  "nodeEmbeddings:hydrateSemanticMatches",
);

export const semanticContext = action({
  args: { queryEmbedding: v.array(v.float64()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    validateEmbeddingVector(args.queryEmbedding);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 12), 1), 40);
    const matches = await ctx.vectorSearch("nodes", "by_owner_embedding", {
      vector: args.queryEmbedding,
      limit,
      filter: (q) => q.eq("ownerId", ownerId),
    });
    return ctx.runQuery(hydrateSemanticMatchesReference, {
      ownerId,
      matches: matches
        .filter((match) => match._score >= MIN_SEMANTIC_SCORE)
        .map((match) => ({ nodeId: match._id, score: match._score })),
    });
  },
});
