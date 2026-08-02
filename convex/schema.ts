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
    embedding: v.optional(v.array(v.float64())),
    embeddingVersion: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    embeddingUpdatedAtMs: v.optional(v.number()),
  })
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"])
    .index("by_slug", ["slug"])
    .vectorIndex("by_owner_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["ownerId"],
    })
    .searchIndex("search_content_owner", { searchField: "contentText", filterFields: ["ownerId"] })
    .searchIndex("search_content_public", { searchField: "contentText", filterFields: ["isPublic"] }),
  nodeChunks: defineTable({
    ownerId: v.string(),
    sourceId: v.string(),
    nodeId: v.string(),
    chunkIndex: v.number(),
    document: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner_node", ["ownerId", "nodeId"]),
  chunkedNodeWriteSessions: defineTable({
    ownerId: v.string(),
    uploadId: v.string(),
    transactionId: v.string(),
    clientId: v.string(),
    nodeId: v.string(),
    expectedVersion: v.number(),
    targetVersion: v.number(),
    oldEntityHash: v.string(),
    newDocumentDigest: v.string(),
    chunkCount: v.number(),
    totalBytes: v.number(),
    metadataHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("finalized")),
    createdAtMs: v.number(),
    expiresAtMs: v.number(),
  })
    .index("by_owner_upload", ["ownerId", "uploadId"])
    .index("by_owner_created", ["ownerId", "createdAtMs"]),
  chunkedNodeWriteParts: defineTable({
    ownerId: v.string(),
    uploadId: v.string(),
    sourceId: v.string(),
    chunkIndex: v.number(),
    document: v.string(),
    digest: v.string(),
    bytes: v.number(),
  })
    .index("by_owner_source", ["ownerId", "sourceId"])
    .index("by_owner_upload", ["ownerId", "uploadId"]),
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
  migrationResets: defineTable({
    operationId: v.string(),
    ownerId: v.string(),
    deletedUsers: v.number(),
    deletedNodes: v.number(),
    deletedRelations: v.number(),
    deletedRelationTypes: v.number(),
    deletedRelationLists: v.number(),
    resetAt: v.string(),
  }).index("by_operation", ["operationId"]),
  agentRuns: defineTable({
    ownerId: v.string(),
    runId: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("proposed"),
      v.literal("rejected"),
      v.literal("applied"),
      v.literal("undone"),
    ),
    provider: v.union(v.literal("openai"), v.literal("openrouter"), v.literal("nodebook")),
    model: v.string(),
    mode: v.union(v.literal("read-only"), v.literal("ask"), v.literal("agent"), v.literal("organize")),
    query: v.string(),
    sourceNodeIds: v.array(v.string()),
    sourceBindings: v.optional(v.array(v.object({
      sourceId: v.string(),
      version: v.number(),
      digest: v.string(),
    }))),
    sourceUrls: v.optional(v.array(v.string())),
    proposalId: v.optional(v.string()),
    memoryEligible: v.optional(v.boolean()),
    summary: v.optional(v.string()),
    stepCount: v.optional(v.number()),
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
  agentProposals: defineTable({
    ownerId: v.string(),
    runId: v.string(),
    proposalId: v.string(),
    proposalDigest: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("applied"),
      v.literal("rejected"),
      v.literal("failed"),
      v.literal("undone"),
    ),
    mode: v.union(v.literal("agent"), v.literal("organize")),
    understanding: v.string(),
    plan: v.array(v.string()),
    summary: v.string(),
    operationsJson: v.string(),
    sourceBindingsJson: v.string(),
    executionMode: v.optional(v.union(v.literal("auto"), v.literal("plan"))),
    riskReasons: v.optional(v.array(v.string())),
    appliedUpdatesJson: v.optional(v.string()),
    inverseUpdatesJson: v.optional(v.string()),
    decisionAt: v.optional(v.string()),
    appliedAt: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.string(),
    createdAtMs: v.number(),
  })
    .index("by_owner_proposal", ["ownerId", "proposalId"])
    .index("by_owner_created", ["ownerId", "createdAtMs"])
    .index("by_owner_run", ["ownerId", "runId"]),
  agentMemories: defineTable({
    ownerId: v.string(),
    memoryId: v.string(),
    runId: v.string(),
    taskClass: v.string(),
    summary: v.string(),
    query: v.string(),
    toolSequence: v.array(v.string()),
    sourceNodeIds: v.array(v.string()),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("rejected"), v.literal("undone")),
    durationMs: v.number(),
    pinned: v.boolean(),
    createdAt: v.string(),
    createdAtMs: v.number(),
    lastUsedAtMs: v.number(),
  })
    .index("by_owner_memory", ["ownerId", "memoryId"])
    .index("by_owner_run", ["ownerId", "runId"])
    .index("by_owner_created", ["ownerId", "createdAtMs"])
    .searchIndex("search_summary_owner", { searchField: "summary", filterFields: ["ownerId"] }),
  agentPatterns: defineTable({
    ownerId: v.string(),
    patternId: v.string(),
    taskClass: v.string(),
    toolSequence: v.array(v.string()),
    successCount: v.number(),
    failureCount: v.number(),
    totalDurationMs: v.number(),
    useCount: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_owner_pattern", ["ownerId", "patternId"])
    .index("by_owner_updated", ["ownerId", "updatedAtMs"]),
  agentModelRoutes: defineTable({
    routeId: v.string(),
    primaryModel: v.optional(v.string()),
    fallbackModels: v.array(v.string()),
    catalogFingerprint: v.optional(v.string()),
    benchmarkVersion: v.optional(v.string()),
    consecutiveFailures: v.number(),
    lastFailureAtMs: v.optional(v.number()),
    lastBenchmarkedAtMs: v.optional(v.number()),
    benchmarkStatus: v.union(v.literal("never"), v.literal("running"), v.literal("ready"), v.literal("failed")),
    updatedAtMs: v.number(),
  }).index("by_route", ["routeId"]),
  agentModelEvaluations: defineTable({
    modelId: v.string(),
    catalogCreatedAt: v.number(),
    benchmarkVersion: v.string(),
    passedCases: v.number(),
    totalCases: v.number(),
    score: v.number(),
    passedCriteria: v.optional(v.number()),
    totalCriteria: v.optional(v.number()),
    medianLatencyMs: v.number(),
    failureReasons: v.array(v.string()),
    testedAtMs: v.number(),
  })
    .index("by_model", ["modelId"])
    .index("by_tested", ["testedAtMs"]),
  agentRuntimeEvaluations: defineTable({
    ownerId: v.string(),
    evalId: v.string(),
    suiteId: v.optional(v.string()),
    caseId: v.string(),
    benchmarkVersion: v.string(),
    provider: v.union(v.literal("openai"), v.literal("openrouter")),
    model: v.string(),
    mode: v.union(v.literal("ask"), v.literal("agent"), v.literal("organize")),
    disposition: v.union(v.literal("read_only"), v.literal("auto_apply"), v.literal("approval_required"), v.literal("preview_only"), v.literal("execution_failed")),
    passed: v.boolean(),
    reasons: v.array(v.string()),
    toolOrder: v.array(v.string()),
    operationKinds: v.array(v.string()),
    selectedNodeIds: v.array(v.string()),
    sourceBindings: v.array(v.object({ sourceId: v.string(), version: v.number(), digest: v.string() })),
    proposalDigest: v.optional(v.string()),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    totalTokens: v.union(v.number(), v.null()),
    latencyMs: v.number(),
    startedAtMs: v.number(),
    completedAtMs: v.number(),
  })
    .index("by_owner_eval", ["ownerId", "evalId"])
    .index("by_owner_created", ["ownerId", "completedAtMs"])
    .index("by_owner_case_created", ["ownerId", "caseId", "completedAtMs"]),
  agentSteps: defineTable({
    ownerId: v.string(),
    runId: v.string(),
    sequence: v.number(),
    tool: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("repaired")),
    inputDigest: v.string(),
    outputDigest: v.string(),
    summary: v.string(),
    startedAt: v.string(),
    completedAt: v.string(),
  }).index("by_owner_run_sequence", ["ownerId", "runId", "sequence"]),
});
