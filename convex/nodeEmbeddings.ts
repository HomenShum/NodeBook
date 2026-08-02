import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { hydrateNodeDocument } from "./nodeDocuments";
import { action, ActionCtx, internalMutation, internalQuery } from "./server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_EMBEDDING_WORK = 24;
const MAX_EMBEDDING_SCAN = 512;
const MAX_EMBEDDING_INPUT_CHARS = 4_000;
const MAX_EMBEDDING_BATCH_CHARS = 100_000;
const MAX_EMBEDDING_RESPONSE_BYTES = 2 * 1024 * 1024;
const EMBEDDING_TIMEOUT_MS = 8_000;
const MIN_SEMANTIC_SCORE = 0.2;

type EmbeddingWorkItem = {
  sourceId: string;
  version: number;
  contentText: string;
};

type StoredEmbedding = {
  sourceId: string;
  version: number;
  embedding: number[];
};

async function authenticatedOwner(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

async function boundedResponseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_EMBEDDING_RESPONSE_BYTES) throw new Error("embedding_response_too_large");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_EMBEDDING_RESPONSE_BYTES) {
    throw new Error("embedding_response_too_large");
  }
  return text;
}

export function parseEmbeddingResponse(body: unknown, expectedCount: number) {
  const rows = Array.isArray((body as { data?: unknown[] })?.data)
    ? (body as { data: Array<{ index?: unknown; embedding?: unknown }> }).data
    : [];
  const embeddings = rows
    .filter((row) => Number.isInteger(row?.index) && Array.isArray(row?.embedding))
    .sort((left, right) => Number(left.index) - Number(right.index))
    .map((row) => row.embedding as number[]);
  if (embeddings.length !== expectedCount) throw new Error("embedding_count_mismatch");
  for (const embedding of embeddings) {
    if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
      throw new Error("embedding_shape_mismatch");
    }
  }
  return embeddings;
}

async function createEmbeddings(input: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("embedding_not_configured");
  if (input.length < 1 || input.length > MAX_EMBEDDING_WORK + 1) throw new Error("embedding_batch_limit");
  const bounded = input.map((value) => value.slice(0, MAX_EMBEDDING_INPUT_CHARS));
  if (bounded.reduce((sum, value) => sum + value.length, 0) > MAX_EMBEDDING_BATCH_CHARS) {
    throw new Error("embedding_input_too_large");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("embedding_timeout"), EMBEDDING_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: bounded,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      }),
      signal: controller.signal,
    });
    const text = await boundedResponseText(response);
    if (!response.ok) throw new Error(`embedding_provider_${response.status}`);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("embedding_response_invalid_json");
    }
    return parseEmbeddingResponse(body, bounded.length);
  } finally {
    clearTimeout(timeout);
  }
}

export const embeddingWork = internalQuery({
  args: { ownerId: v.string(), limit: v.number() },
  handler: async (ctx, args): Promise<EmbeddingWorkItem[]> => {
    const limit = Math.min(Math.max(Math.trunc(args.limit), 1), MAX_EMBEDDING_WORK);
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
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

export const storeEmbeddings = internalMutation({
  args: {
    ownerId: v.string(),
    items: v.array(v.object({
      sourceId: v.string(),
      version: v.number(),
      embedding: v.array(v.float64()),
    })),
  },
  handler: async (ctx, args) => {
    if (args.items.length > MAX_EMBEDDING_WORK) throw new Error("EMBEDDING_BATCH_LIMIT_EXCEEDED");
    let stored = 0;
    for (const item of args.items) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS || item.embedding.some((value) => !Number.isFinite(value))) {
        throw new Error("INVALID_EMBEDDING_VECTOR");
      }
      const node = await ctx.db
        .query("nodes")
        .withIndex("by_owner_source", (q) => q.eq("ownerId", args.ownerId).eq("sourceId", item.sourceId))
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

const embeddingWorkReference = makeFunctionReference<"query", { ownerId: string; limit: number }, EmbeddingWorkItem[]>(
  "nodeEmbeddings:embeddingWork",
);
const storeEmbeddingsReference = makeFunctionReference<"mutation", { ownerId: string; items: StoredEmbedding[] }, { stored: number }>(
  "nodeEmbeddings:storeEmbeddings",
);
const hydrateSemanticMatchesReference = makeFunctionReference<"query", any, any>(
  "nodeEmbeddings:hydrateSemanticMatches",
);

function degradedReason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("timeout")) return "provider_timeout";
    if (/embedding_provider_\d+/.test(error.message)) return error.message;
    if (error.message.startsWith("embedding_")) return error.message;
  }
  return "embedding_unavailable";
}

export const semanticContext = action({
  args: { text: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{
    status: "ready" | "degraded";
    reason?: string;
    model: string;
    indexedCount: number;
    nodes: any[];
  }> => {
    const ownerId = await authenticatedOwner(ctx);
    const text = args.text.trim().slice(0, 2_000);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 12), 1), 40);
    if (text.length < 3) return { status: "degraded", reason: "query_too_short", model: EMBEDDING_MODEL, indexedCount: 0, nodes: [] };
    try {
      const work = await ctx.runQuery(embeddingWorkReference, { ownerId, limit: MAX_EMBEDDING_WORK });
      const embeddings = await createEmbeddings([text, ...work.map((item) => item.contentText)]);
      if (work.length > 0) {
        await ctx.runMutation(storeEmbeddingsReference, {
          ownerId,
          items: work.map((item, index) => ({ ...item, embedding: embeddings[index + 1] })),
        });
      }
      const matches = await ctx.vectorSearch("nodes", "by_owner_embedding", {
        vector: embeddings[0],
        limit,
        filter: (q) => q.eq("ownerId", ownerId),
      });
      const nodes = await ctx.runQuery(hydrateSemanticMatchesReference, {
        ownerId,
        matches: matches
          .filter((match) => match._score >= MIN_SEMANTIC_SCORE)
          .map((match) => ({ nodeId: match._id, score: match._score })),
      });
      return { status: "ready", model: EMBEDDING_MODEL, indexedCount: work.length, nodes };
    } catch (error) {
      return { status: "degraded", reason: degradedReason(error), model: EMBEDDING_MODEL, indexedCount: 0, nodes: [] };
    }
  },
});
