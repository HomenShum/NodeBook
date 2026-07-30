import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const graphEntity = {
  ownerId: v.string(),
  sourceId: v.string(),
  version: v.number(),
  isPublic: v.boolean(),
  document: v.string(),
  updatedAt: v.string(),
};

export default defineSchema({
  users: defineTable({
    ownerId: v.string(),
    document: v.string(),
    updatedAt: v.string(),
  }).index("by_owner", ["ownerId"]),
  nodes: defineTable({
    ...graphEntity,
    slug: v.optional(v.union(v.string(), v.null())),
    contentText: v.optional(v.string()),
  })
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"])
    .index("by_slug", ["slug"])
    .searchIndex("search_content_owner", { searchField: "contentText", filterFields: ["ownerId"] })
    .searchIndex("search_content_public", { searchField: "contentText", filterFields: ["isPublic"] }),
  relations: defineTable(graphEntity)
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"]),
  relationTypes: defineTable(graphEntity)
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"]),
  relationLists: defineTable({
    ownerId: v.string(),
    sourceId: v.string(),
    nodeId: v.string(),
    relationId: v.string(),
    type: v.union(v.literal("pinned"), v.literal("noteContent"), v.literal("all")),
    isPublic: v.boolean(),
    document: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"]),
  syncTransactions: defineTable({
    ownerId: v.string(),
    transactionId: v.string(),
    payloadHash: v.string(),
    updateCount: v.number(),
    appliedAt: v.string(),
    appliedAtMs: v.number(),
  })
    .index("by_owner_transaction", ["ownerId", "transactionId"])
    .index("by_owner_applied", ["ownerId", "appliedAtMs"]),
  syncFeed: defineTable({
    ownerId: v.string(),
    transactionId: v.string(),
    ownerStreamKey: v.string(),
    publicStreamKey: v.string(),
    payload: v.string(),
    publicPayload: v.union(v.string(), v.null()),
    hasPublicUpdates: v.boolean(),
    appliedAtMs: v.number(),
  })
    .index("by_owner_stream", ["ownerId", "ownerStreamKey"])
    .index("by_public_stream", ["hasPublicUpdates", "publicStreamKey"]),
  notifications: defineTable({
    userId: v.string(),
    mentionedById: v.string(),
    nodeId: v.string(),
    isRead: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_mentioned_by", ["mentionedById"]),
  expansionStates: defineTable({
    ownerId: v.string(),
    rootObjectId: v.string(),
    expandedObjects: v.array(v.string()),
    updatedAt: v.string(),
  })
    .index("by_owner_root", ["ownerId", "rootObjectId"])
    .index("by_owner", ["ownerId"]),
  canonicalPaths: defineTable({
    ownerId: v.string(),
    objectId: v.string(),
    ancestors: v.array(v.object({ id: v.string(), label: v.string() })),
    updatedAt: v.string(),
  })
    .index("by_owner_object", ["ownerId", "objectId"])
    .index("by_owner", ["ownerId"]),
  migrationBatches: defineTable({
    sourceKey: v.string(),
    batchKey: v.string(),
    digest: v.string(),
    rowCount: v.number(),
    importedAt: v.string(),
  }).index("by_source_batch", ["sourceKey", "batchKey"]),
  agentRuns: defineTable({
    ownerId: v.string(),
    runId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    provider: v.literal("openai"),
    model: v.string(),
    mode: v.literal("read-only"),
    query: v.string(),
    sourceNodeIds: v.array(v.string()),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    totalTokens: v.union(v.number(), v.null()),
    error: v.optional(v.string()),
    startedAt: v.string(),
    completedAt: v.string(),
    startedAtMs: v.number(),
  })
    .index("by_owner_run", ["ownerId", "runId"])
    .index("by_owner_started", ["ownerId", "startedAtMs"]),
});
