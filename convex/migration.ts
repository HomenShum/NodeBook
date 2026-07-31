import { ConvexError, v } from "convex/values";

import { internalMutation } from "./server";

const MAX_BATCH_ROWS = 50;
const MAX_BATCH_BYTES = 768 * 1024;

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function contentText(document: string) {
  const entity = JSON.parse(document);
  if (!Array.isArray(entity.content)) return "";
  return entity.content
    .map((part: unknown) =>
      part && typeof part === "object" && typeof (part as { value?: unknown }).value === "string"
        ? (part as { value: string }).value
        : "",
    )
    .join(" ")
    .slice(0, 32_768);
}

export const importBatch = internalMutation({
  args: {
    sourceKey: v.string(),
    batchKey: v.string(),
    digest: v.string(),
    table: v.union(
      v.literal("users"),
      v.literal("nodes"),
      v.literal("relations"),
      v.literal("relationTypes"),
      v.literal("relationLists"),
    ),
    rowsJson: v.string(),
  },
  handler: async (ctx, args) => {
    if (new TextEncoder().encode(args.rowsJson).byteLength > MAX_BATCH_BYTES) {
      fail("BATCH_TOO_LARGE", "migration batch exceeds 768 KiB");
    }
    if ((await sha256(args.rowsJson)) !== args.digest) fail("DIGEST_MISMATCH", "migration batch digest is invalid");
    const existingBatch = await ctx.db
      .query("migrationBatches")
      .withIndex("by_source_batch", (q) => q.eq("sourceKey", args.sourceKey).eq("batchKey", args.batchKey))
      .unique();
    if (existingBatch) {
      if (existingBatch.digest !== args.digest) fail("IDEMPOTENCY_CONFLICT", "batch key was reused with different data");
      return { status: "ok" as const, replayed: true, imported: existingBatch.rowCount };
    }
    const rows = JSON.parse(args.rowsJson) as Record<string, any>[];
    if (!Array.isArray(rows) || rows.length > MAX_BATCH_ROWS) fail("INVALID_BATCH", "migration batch row count is invalid");

    for (const row of rows) {
      if (args.table === "users") {
        const current = await ctx.db.query("users").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId)).unique();
        if (current && current.document !== row.document) fail("ROW_CONFLICT", "user already exists with different data");
        if (!current) await ctx.db.insert("users", { ownerId: row.ownerId, document: row.document, updatedAt: row.updatedAt });
        continue;
      }
      const current = await ctx.db
        .query(args.table)
        .withIndex("by_owner_source", (q) => q.eq("ownerId", row.ownerId).eq("sourceId", row.sourceId))
        .unique();
      if (current && current.document !== row.document) fail("ROW_CONFLICT", "entity already exists with different data");
      if (current) continue;
      if (args.table === "relationLists") {
        await ctx.db.insert("relationLists", row as any);
      } else if (args.table === "nodes") {
        const entity = JSON.parse(row.document);
        await ctx.db.insert("nodes", {
          ...row,
          slug: entity.slug ?? null,
          contentText: contentText(row.document),
        } as any);
      } else {
        await ctx.db.insert(args.table, row as any);
      }
    }
    await ctx.db.insert("migrationBatches", {
      sourceKey: args.sourceKey,
      batchKey: args.batchKey,
      digest: args.digest,
      rowCount: rows.length,
      importedAt: new Date().toISOString(),
    });
    return { status: "ok" as const, replayed: false, imported: rows.length };
  },
});

export const clearOwnerGraph = internalMutation({
  args: {
    operationId: v.string(),
    ownerId: v.string(),
    expected: v.object({
      users: v.number(),
      nodes: v.number(),
      relations: v.number(),
      relationTypes: v.number(),
      relationLists: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    if (!args.operationId || !args.ownerId) fail("INVALID_RESET", "operationId and ownerId are required");
    const replay = await ctx.db
      .query("migrationResets")
      .withIndex("by_operation", (q) => q.eq("operationId", args.operationId))
      .unique();
    if (replay) return { status: "ok" as const, replayed: true, ...replay };
    if ((await ctx.db.query("migrationBatches").take(1)).length) {
      fail("MIGRATION_STARTED", "owner graph cannot be cleared after migration batches exist");
    }

    const users = await ctx.db.query("users").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).take(2);
    const nodes = await ctx.db.query("nodes").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).take(501);
    const relations = await ctx.db.query("relations").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).take(501);
    const relationTypes = await ctx.db
      .query("relationTypes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .take(501);
    const relationLists = await ctx.db
      .query("relationLists")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .take(501);
    const actual = {
      users: users.length,
      nodes: nodes.length,
      relations: relations.length,
      relationTypes: relationTypes.length,
      relationLists: relationLists.length,
    };
    const countsMatch =
      actual.users === args.expected.users &&
      actual.nodes === args.expected.nodes &&
      actual.relations === args.expected.relations &&
      actual.relationTypes === args.expected.relationTypes &&
      actual.relationLists === args.expected.relationLists;
    if (Object.values(actual).some((count) => count > 500) || !countsMatch) {
      fail("RESET_PRECONDITION_FAILED", "owner graph counts do not match the exact reset precondition");
    }
    for (const row of [...relationLists, ...relations, ...relationTypes, ...nodes, ...users]) await ctx.db.delete(row._id);
    const receipt = {
      operationId: args.operationId,
      ownerId: args.ownerId,
      deletedUsers: users.length,
      deletedNodes: nodes.length,
      deletedRelations: relations.length,
      deletedRelationTypes: relationTypes.length,
      deletedRelationLists: relationLists.length,
      resetAt: new Date().toISOString(),
    };
    await ctx.db.insert("migrationResets", receipt);
    return { status: "ok" as const, replayed: false, ...receipt };
  },
});
