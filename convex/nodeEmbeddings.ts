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
const MAX_KNOWLEDGE_MAP_NODES = 12;
const MAX_KNOWLEDGE_MAP_CLUSTERS = 5;
const MAX_KNOWLEDGE_MAP_CONTEXT_CHARS = 6_000;
const MAX_KNOWLEDGE_MAP_HYDRATION_ATTEMPTS = 48;
const KNOWLEDGE_MAP_ITERATIONS = 8;

type KnowledgeMapVectorRow = {
  sourceId: string;
  contentText: string;
  embedding: number[];
};

const KNOWLEDGE_MAP_STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "been", "before", "being", "between", "could", "from",
  "have", "into", "more", "most", "note", "notes", "only", "other", "over", "should", "that", "their",
  "there", "these", "they", "this", "through", "under", "using", "very", "what", "when", "where", "which",
  "while", "with", "would", "your",
]);

function squaredDistance(left: number[], right: number[]) {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index] - right[index];
    distance += delta * delta;
  }
  return distance;
}

function knowledgeMapTitle(rows: KnowledgeMapVectorRow[], fallbackIndex: number) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const tokens = new Set(
      row.contentText.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? [],
    );
    for (const token of tokens) {
      if (!KNOWLEDGE_MAP_STOP_WORDS.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const words = [...counts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([word]) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`);
  return words.length ? words.join(" · ").slice(0, 80) : `Topic ${fallbackIndex + 1}`;
}

export function clusterKnowledgeMapRows(rows: KnowledgeMapVectorRow[], requestedClusters?: number) {
  const boundedRows = [...rows]
    .filter((row) => row.embedding.length > 0 && row.embedding.every(Number.isFinite))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
    .slice(0, MAX_KNOWLEDGE_MAP_NODES);
  if (boundedRows.length < 4) return [];
  const dimensions = boundedRows[0].embedding.length;
  if (boundedRows.some((row) => row.embedding.length !== dimensions)) return [];
  const inferredClusters = Math.max(2, Math.floor(Math.sqrt(boundedRows.length)));
  const clusterCount = Math.min(
    MAX_KNOWLEDGE_MAP_CLUSTERS,
    boundedRows.length,
    Math.max(2, Math.trunc(requestedClusters ?? inferredClusters)),
  );

  const centroids: number[][] = [[...boundedRows[0].embedding]];
  while (centroids.length < clusterCount) {
    const next = boundedRows
      .map((row) => ({ row, distance: Math.min(...centroids.map((centroid) => squaredDistance(row.embedding, centroid))) }))
      .sort((left, right) => right.distance - left.distance || left.row.sourceId.localeCompare(right.row.sourceId))[0];
    centroids.push([...next.row.embedding]);
  }

  let assignments = new Array<number>(boundedRows.length).fill(-1);
  for (let iteration = 0; iteration < KNOWLEDGE_MAP_ITERATIONS; iteration += 1) {
    const nextAssignments = boundedRows.map((row) => centroids
      .map((centroid, index) => ({ index, distance: squaredDistance(row.embedding, centroid) }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)[0].index);
    if (nextAssignments.every((assignment, index) => assignment === assignments[index])) break;
    assignments = nextAssignments;
    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      const members = boundedRows.filter((_row, index) => assignments[index] === clusterIndex);
      if (!members.length) continue;
      centroids[clusterIndex] = Array.from({ length: dimensions }, (_value, dimension) =>
        members.reduce((sum, row) => sum + row.embedding[dimension], 0) / members.length,
      );
    }
  }

  return Array.from({ length: clusterCount }, (_value, clusterIndex) => {
    const members = boundedRows.filter((_row, index) => assignments[index] === clusterIndex);
    return {
      clusterId: `semantic-cluster-${clusterIndex + 1}`,
      title: knowledgeMapTitle(members, clusterIndex),
      nodeIds: members.map((row) => row.sourceId),
    };
  }).filter((cluster) => cluster.nodeIds.length > 0);
}

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

export const knowledgeMap = query({
  args: {
    rootNodeId: v.string(),
    requestedClusters: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerId = await authenticatedOwner(ctx);
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(MAX_EMBEDDING_SCAN);
    const candidates = nodes
      .filter((node) => node.sourceId !== args.rootNodeId)
      .filter((node) => (node.contentText?.trim().length ?? 0) >= 3)
      .filter((node) => node.embeddingVersion === node.version && node.embeddingModel === EMBEDDING_MODEL)
      .filter((node) => Array.isArray(node.embedding) && node.embedding.length === EMBEDDING_DIMENSIONS)
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
    const selected: Array<{ node: (typeof candidates)[number]; document: string }> = [];
    for (const node of candidates.slice(0, MAX_KNOWLEDGE_MAP_HYDRATION_ATTEMPTS)) {
      const document = await hydrateNodeDocument(ctx, node);
      if ((node.contentText?.length ?? 0) + document.length > MAX_KNOWLEDGE_MAP_CONTEXT_CHARS) continue;
      selected.push({ node, document });
      if (selected.length >= MAX_KNOWLEDGE_MAP_NODES) break;
    }
    const clusters = clusterKnowledgeMapRows(
      selected.map(({ node }) => ({ sourceId: node.sourceId, contentText: node.contentText ?? "", embedding: node.embedding! })),
      args.requestedClusters,
    );
    if (!clusters.length) {
      return {
        status: "insufficient_nodes" as const,
        model: EMBEDDING_MODEL,
        scannedCount: nodes.length,
        candidateCount: candidates.length,
        selectedCount: selected.length,
        nodes: [],
        clusters: [],
      };
    }
    return {
      status: "ready" as const,
      model: EMBEDDING_MODEL,
      scannedCount: nodes.length,
      candidateCount: candidates.length,
      selectedCount: selected.length,
      nodes: selected.map(({ node, document }) => ({
        sourceId: node.sourceId,
        version: node.version,
        contentText: node.contentText ?? "",
        document,
        updatedAt: node.updatedAt,
        retrievalSignals: ["semantic_cluster"],
      })),
      clusters,
    };
  },
});
