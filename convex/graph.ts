import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./server";

const MAX_SYNC_BYTES = 512 * 1024;
const MAX_SYNC_UPDATES = 500;
const MAX_ENTITY_BYTES = 256 * 1024;
const MAX_PAGE_SIZE = 128;
const MAX_ID_LENGTH = 2_048;
const MAX_SYNC_TRANSACTIONS_PER_OWNER = 1_000;
const MAX_SYNC_FEED_ITEMS_PER_OWNER = 20;
const MAX_NOTIFICATIONS_PER_USER = 500;
const MAX_EXPANSION_STATES_PER_OWNER = 2_000;
const MAX_CANONICAL_PATHS_PER_OWNER = 2_000;

type Entity = {
  id: string;
  authorId: string;
  version: number;
  isPublic?: boolean;
  slug?: string | null;
  content?: unknown;
};

type SyncUpdate =
  | { operation: "addNode"; node: Entity }
  | { operation: "updateNode"; oldProps: Entity; newProps: Entity }
  | { operation: "deleteNode"; node: Entity }
  | { operation: "addRelation"; relation: Entity }
  | { operation: "updateRelation"; oldProps: Entity; newProps: Entity }
  | { operation: "deleteRelation"; deleted: { relation: Entity } }
  | {
      operation: "updateRelationList";
      authorId: string;
      nodeId: string;
      relationId: string;
      type: "pinned" | "noteContent" | "all";
      newPosition: { int: number; frac: string } | null;
      newIsPublic: boolean;
    };

type SyncPayload = {
  clientId: string;
  userId: string;
  transactionId: string;
  updates: SyncUpdate[];
};

type UserDocument = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  createdAt: string;
  settings: Record<string, unknown>;
};

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function boundedId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID_LENGTH) {
    fail("INVALID_SYNC", `${field} must be bounded non-empty text`);
  }
  return value;
}

function parsePayload(payload: string): SyncPayload {
  if (utf8Bytes(payload) > MAX_SYNC_BYTES) fail("SYNC_TOO_LARGE", "sync payload exceeds 512 KiB");
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    fail("INVALID_SYNC", "sync payload is not valid JSON");
  }
  if (!data || typeof data !== "object") fail("INVALID_SYNC", "sync payload must be an object");
  const candidate = data as Partial<SyncPayload>;
  boundedId(candidate.clientId, "clientId");
  boundedId(candidate.userId, "userId");
  boundedId(candidate.transactionId, "transactionId");
  if (!Array.isArray(candidate.updates) || candidate.updates.length > MAX_SYNC_UPDATES) {
    fail("INVALID_SYNC", `updates must contain at most ${MAX_SYNC_UPDATES} entries`);
  }
  return candidate as SyncPayload;
}

async function ownerId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) fail("AUTH_REQUIRED", "an authenticated identity is required");
  return identity.subject;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseUserDocument(payload: string, expectedOwner: string): UserDocument {
  if (utf8Bytes(payload) > MAX_ENTITY_BYTES) fail("ENTITY_TOO_LARGE", "user document exceeds 256 KiB");
  let user: unknown;
  try {
    user = JSON.parse(payload);
  } catch {
    fail("INVALID_USER", "user payload is not valid JSON");
  }
  if (!user || typeof user !== "object") fail("INVALID_USER", "user payload must be an object");
  const candidate = user as Partial<UserDocument>;
  if (candidate.id !== expectedOwner) fail("OWNER_MISMATCH", "user id does not match authenticated identity");
  boundedId(candidate.username, "username");
  if (typeof candidate.createdAt !== "string" || Number.isNaN(Date.parse(candidate.createdAt))) {
    fail("INVALID_USER", "createdAt must be an ISO date");
  }
  if (!candidate.settings || typeof candidate.settings !== "object" || Array.isArray(candidate.settings)) {
    fail("INVALID_USER", "settings must be an object");
  }
  return candidate as UserDocument;
}

function serializeEntity(entity: Entity) {
  const document = JSON.stringify(entity);
  if (utf8Bytes(document) > MAX_ENTITY_BYTES) fail("ENTITY_TOO_LARGE", "graph entity exceeds 256 KiB");
  return document;
}

function isDerivedSameVersionUpdate(oldEntity: Entity, newEntity: Entity) {
  const derivedKeys = new Set(["canonicalRelationId", "relationCount", "updatedAt"]);
  const keys = new Set([...Object.keys(oldEntity), ...Object.keys(newEntity)]);
  for (const key of keys) {
    if (derivedKeys.has(key)) continue;
    if (JSON.stringify((oldEntity as Record<string, unknown>)[key])
      !== JSON.stringify((newEntity as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

function entityContentText(entity: Entity) {
  if (!Array.isArray(entity.content)) return "";
  return entity.content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = (part as { value?: unknown }).value;
      return typeof value === "string" ? value : "";
    })
    .join(" ")
    .slice(0, 32_768);
}

function assertOwnedEntity(entity: Entity, expectedOwner: string, field: string) {
  boundedId(entity?.id, `${field}.id`);
  if (entity?.authorId !== expectedOwner) fail("OWNER_MISMATCH", `${field}.authorId does not match the authenticated user`);
  if (!Number.isSafeInteger(entity?.version) || entity.version < 1) {
    fail("INVALID_VERSION", `${field}.version must be a positive integer`);
  }
}

async function existingEntity(
  ctx: MutationCtx,
  table: "nodes" | "relations",
  owner: string,
  sourceId: string,
) {
  return ctx.db
    .query(table)
    .withIndex("by_owner_source", (q) => q.eq("ownerId", owner).eq("sourceId", sourceId))
    .unique();
}

async function addEntity(
  ctx: MutationCtx,
  table: "nodes" | "relations",
  owner: string,
  entity: Entity,
) {
  assertOwnedEntity(entity, owner, table);
  const current = await existingEntity(ctx, table, owner, entity.id);
  const document = serializeEntity(entity);
  if (current) {
    if (current.version === entity.version && current.document === document) return;
    fail("ENTITY_EXISTS", `${table} entity already exists with different data`);
  }
  await ctx.db.insert(table, {
    ownerId: owner,
    sourceId: entity.id,
    version: entity.version,
    isPublic: entity.isPublic === true,
    document,
    updatedAt: new Date().toISOString(),
    ...(table === "nodes" ? { slug: entity.slug ?? null, contentText: entityContentText(entity) } : {}),
  });
}

async function updateEntity(
  ctx: MutationCtx,
  table: "nodes" | "relations",
  owner: string,
  oldEntity: Entity,
  newEntity: Entity,
) {
  assertOwnedEntity(oldEntity, owner, `old ${table}`);
  assertOwnedEntity(newEntity, owner, `new ${table}`);
  const advancesVersion = newEntity.version === oldEntity.version + 1;
  const updatesDerivedStateAtSameVersion =
    newEntity.version === oldEntity.version && isDerivedSameVersionUpdate(oldEntity, newEntity);
  if (oldEntity.id !== newEntity.id || (!advancesVersion && !updatesDerivedStateAtSameVersion)) {
    fail("INVALID_VERSION", `${table} update must advance the same entity by exactly one version`);
  }
  const current = await existingEntity(ctx, table, owner, oldEntity.id);
  const oldDocument = serializeEntity(oldEntity);
  if (!current || current.version !== oldEntity.version) {
    fail("VERSION_CONFLICT", `${table} update is based on a stale version`);
  }
  if (
    advancesVersion
    && current.document !== oldDocument
    && !isDerivedSameVersionUpdate(JSON.parse(current.document) as Entity, oldEntity)
  ) {
    fail("VERSION_CONFLICT", `${table} update is based on stale entity content`);
  }
  if (
    updatesDerivedStateAtSameVersion
    && !isDerivedSameVersionUpdate(JSON.parse(current.document) as Entity, newEntity)
  ) {
    fail("VERSION_CONFLICT", `${table} derived update conflicts with current entity content`);
  }
  await ctx.db.patch(current._id, {
    version: newEntity.version,
    isPublic: newEntity.isPublic === true,
    document: serializeEntity(newEntity),
    updatedAt: new Date().toISOString(),
    ...(table === "nodes"
      ? { slug: newEntity.slug ?? null, contentText: entityContentText(newEntity) }
      : {}),
  });
}

async function deleteEntity(
  ctx: MutationCtx,
  table: "nodes" | "relations",
  owner: string,
  entity: Entity,
) {
  assertOwnedEntity(entity, owner, table);
  const current = await existingEntity(ctx, table, owner, entity.id);
  if (!current) return;
  if (current.version !== entity.version) fail("VERSION_CONFLICT", `${table} delete is based on a stale version`);
  await ctx.db.delete(current._id);
}

async function updateRelationList(
  ctx: MutationCtx,
  owner: string,
  update: Extract<SyncUpdate, { operation: "updateRelationList" }>,
) {
  if (update.authorId !== owner) fail("OWNER_MISMATCH", "relation-list author does not match authenticated user");
  boundedId(update.nodeId, "nodeId");
  boundedId(update.relationId, "relationId");
  if (!["pinned", "noteContent", "all"].includes(update.type)) fail("INVALID_SYNC", "invalid relation-list type");
  const sourceId = `${update.nodeId}\u001f${update.relationId}\u001f${update.type}`;
  const document = JSON.stringify(update);
  if (utf8Bytes(document) > MAX_ENTITY_BYTES) fail("ENTITY_TOO_LARGE", "relation-list entry exceeds 256 KiB");
  const current = await ctx.db
    .query("relationLists")
    .withIndex("by_owner_source", (q) => q.eq("ownerId", owner).eq("sourceId", sourceId))
    .unique();
  if (update.newPosition === null) {
    if (current) await ctx.db.delete(current._id);
    return;
  }
  const value = {
    ownerId: owner,
    sourceId,
    nodeId: update.nodeId,
    relationId: update.relationId,
    type: update.type,
    isPublic: update.newIsPublic,
    document,
    updatedAt: new Date().toISOString(),
  };
  if (current) await ctx.db.replace(current._id, value);
  else await ctx.db.insert("relationLists", value);
}

export const cleanupRelationListTombstones = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 100);
    const rows = await ctx.db
      .query("relationLists")
      .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
      .take(limit);
    let deleted = 0;
    for (const row of rows) {
      let document: { newPosition?: unknown } | null = null;
      try {
        document = JSON.parse(row.document);
      } catch {
        // Malformed derived rows are not safe to hydrate.
      }
      if (!document || document.newPosition === null || document.newPosition === undefined) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { inspected: rows.length, deleted };
  },
});

export const applySync = mutation({
  args: { payload: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const data = parsePayload(args.payload);
    if (data.userId !== authenticatedOwner) fail("OWNER_MISMATCH", "sync user does not match authenticated identity");
    const payloadHash = await sha256(args.payload);
    const existing = await ctx.db
      .query("syncTransactions")
      .withIndex("by_owner_transaction", (q) =>
        q.eq("ownerId", authenticatedOwner).eq("transactionId", data.transactionId),
      )
      .unique();
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        fail("IDEMPOTENCY_CONFLICT", "transaction id was reused with a different payload");
      }
      return { status: "ok" as const, replayed: true, applied: existing.updateCount };
    }

    for (const update of data.updates) {
      switch (update.operation) {
        case "addNode":
          await addEntity(ctx, "nodes", authenticatedOwner, update.node);
          break;
        case "updateNode":
          await updateEntity(ctx, "nodes", authenticatedOwner, update.oldProps, update.newProps);
          break;
        case "deleteNode":
          await deleteEntity(ctx, "nodes", authenticatedOwner, update.node);
          break;
        case "addRelation":
          await addEntity(ctx, "relations", authenticatedOwner, update.relation);
          break;
        case "updateRelation":
          await updateEntity(ctx, "relations", authenticatedOwner, update.oldProps, update.newProps);
          break;
        case "deleteRelation":
          await deleteEntity(ctx, "relations", authenticatedOwner, update.deleted.relation);
          break;
        case "updateRelationList":
          await updateRelationList(ctx, authenticatedOwner, update);
          break;
        default:
          fail("UNSUPPORTED_UPDATE", "sync contains an unsupported update operation");
      }
    }

    const appliedAtMs = Date.now();
    const timestamp = appliedAtMs.toString().padStart(16, "0");
    await ctx.db.insert("syncTransactions", {
      ownerId: authenticatedOwner,
      transactionId: data.transactionId,
      payloadHash,
      updateCount: data.updates.length,
      appliedAt: new Date().toISOString(),
      appliedAtMs,
    });
    await ctx.db.insert("syncFeed", {
      ownerId: authenticatedOwner,
      transactionId: data.transactionId,
      ownerStreamKey: `${timestamp}:${data.transactionId}`,
      publicStreamKey: `${timestamp}:${authenticatedOwner}:${data.transactionId}`,
      payload: args.payload,
      publicPayload: JSON.stringify({
        ...data,
        updates: data.updates.filter((update) => {
          if ("node" in update) return update.node.isPublic === true;
          if ("relation" in update) return update.relation.isPublic === true;
          if ("newProps" in update) return update.newProps.isPublic === true;
          if ("deleted" in update) return update.deleted.relation.isPublic === true;
          return update.newIsPublic === true;
        }),
      }),
      hasPublicUpdates: data.updates.some((update) => {
        if ("node" in update) return update.node.isPublic === true;
        if ("relation" in update) return update.relation.isPublic === true;
        if ("newProps" in update) return update.newProps.isPublic === true;
        if ("deleted" in update) return update.deleted.relation.isPublic === true;
        return update.newIsPublic === true;
      }),
      appliedAtMs,
    });
    const retainedTransactions = await ctx.db
      .query("syncTransactions")
      .withIndex("by_owner_applied", (q) => q.eq("ownerId", authenticatedOwner))
      .order("desc")
      .take(MAX_SYNC_TRANSACTIONS_PER_OWNER + 1);
    if (retainedTransactions.length > MAX_SYNC_TRANSACTIONS_PER_OWNER) {
      await ctx.db.delete(retainedTransactions[MAX_SYNC_TRANSACTIONS_PER_OWNER]._id);
    }
    const retainedFeed = await ctx.db
      .query("syncFeed")
      .withIndex("by_owner_stream", (q) => q.eq("ownerId", authenticatedOwner))
      .order("desc")
      .take(MAX_SYNC_FEED_ITEMS_PER_OWNER + 1);
    if (retainedFeed.length > MAX_SYNC_FEED_ITEMS_PER_OWNER) {
      await ctx.db.delete(retainedFeed[MAX_SYNC_FEED_ITEMS_PER_OWNER]._id);
    }
    return { status: "ok" as const, replayed: false, applied: data.updates.length };
  },
});

const snapshotTable = v.union(
  v.literal("nodes"),
  v.literal("relations"),
  v.literal("relationTypes"),
  v.literal("relationLists"),
);

export const snapshotPage = query({
  args: {
    table: snapshotTable,
    visibility: v.union(v.literal("owned"), v.literal("public")),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const limit = Math.min(
      Number.isSafeInteger(args.limit) && (args.limit ?? 0) > 0 ? args.limit! : MAX_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const pagination = { cursor: args.cursor, numItems: limit };
    const getPage = (table: typeof args.table) => {
      const base = ctx.db.query(table);
      return args.visibility === "owned"
        ? base.withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner)).paginate(pagination)
        : base.withIndex("by_public", (q) => q.eq("isPublic", true)).paginate(pagination);
    };
    const page = await getPage(args.table);
    return {
      items: page.page.map((item) => item.document),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const authenticatedOwner = await ownerId(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
      .unique();
    return user?.document ?? null;
  },
});

export const getOrCreateUser = mutation({
  args: { payload: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const incoming = parseUserDocument(args.payload, authenticatedOwner);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
      .unique();
    if (existing) return existing.document;
    const document = JSON.stringify({ ...incoming, settings: {} });
    await ctx.db.insert("users", {
      ownerId: authenticatedOwner,
      document,
      updatedAt: new Date().toISOString(),
    });
    return document;
  },
});

export const updateUserSettings = mutation({
  args: { payload: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const incoming = parseUserDocument(args.payload, authenticatedOwner);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
      .unique();
    if (!existing) fail("USER_NOT_FOUND", "user must exist before settings can be updated");
    const current = JSON.parse(existing.document) as UserDocument;
    const document = JSON.stringify({ ...current, settings: incoming.settings });
    await ctx.db.patch(existing._id, { document, updatedAt: new Date().toISOString() });
    return document;
  },
});

export const recentTransactions = query({
  args: {
    ownerCursor: v.string(),
    publicCursor: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), MAX_SYNC_FEED_ITEMS_PER_OWNER);
    const own = await ctx.db
      .query("syncFeed")
      .withIndex("by_owner_stream", (q) =>
        q.eq("ownerId", authenticatedOwner).gt("ownerStreamKey", args.ownerCursor),
      )
      .take(limit);
    const shared = await ctx.db
      .query("syncFeed")
      .withIndex("by_public_stream", (q) =>
        q.eq("hasPublicUpdates", true).gt("publicStreamKey", args.publicCursor),
      )
      .take(limit);
    return {
      own: own.map((entry) => ({
        cursor: entry.ownerStreamKey,
        payload: entry.payload,
        appliedAtMs: entry.appliedAtMs,
      })),
      shared: shared.map((entry) => ({
        cursor: entry.publicStreamKey,
        payload: entry.ownerId === authenticatedOwner ? null : entry.publicPayload,
        appliedAtMs: entry.appliedAtMs,
      })),
    };
  },
});

export const searchNodes = query({
  args: { text: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const text = args.text.trim().slice(0, 512);
    if (text.length < 3) fail("INVALID_SEARCH", "search text must contain at least three characters");
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 100);
    const owned = await ctx.db
      .query("nodes")
      .withSearchIndex("search_content_owner", (q) => q.search("contentText", text).eq("ownerId", authenticatedOwner))
      .take(limit);
    const shared = await ctx.db
      .query("nodes")
      .withSearchIndex("search_content_public", (q) => q.search("contentText", text).eq("isPublic", true))
      .take(limit);
    const unique = new Map<string, string>();
    for (const item of [...shared, ...owned]) unique.set(item.sourceId, item.document);
    return Array.from(unique.values()).slice(0, limit);
  },
});

export const resolveSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    await ownerId(ctx);
    const rows = await ctx.db.query("nodes").withIndex("by_slug", (q) => q.eq("slug", args.slug)).take(2);
    if (rows.length > 1) fail("SLUG_CONFLICT", "slug is not unique");
    return rows[0]?.document ?? null;
  },
});

export const listSlugs = query({
  args: {},
  handler: async (ctx) => {
    const authenticatedOwner = await ownerId(ctx);
    const nodes = await ctx.db.query("nodes").withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner)).take(5_001);
    if (nodes.length > 5_000) fail("SLUG_LIST_LIMIT", "slug list exceeds the 5,000-node bound");
    return nodes
      .filter((node) => node.slug)
      .map((node) => ({ id: node.sourceId, slug: node.slug! }));
  },
});

export const setSlug = mutation({
  args: { nodeId: v.string(), slug: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const slug = args.slug?.trim() || null;
    if (slug && (slug.length > 128 || slug.includes("/") || slug === "home")) {
      fail("INVALID_SLUG", "slug is invalid");
    }
    if (slug) {
      const existing = await ctx.db.query("nodes").withIndex("by_slug", (q) => q.eq("slug", slug)).take(1);
      if (existing[0] && (existing[0].ownerId !== authenticatedOwner || existing[0].sourceId !== args.nodeId)) {
        fail("SLUG_IN_USE", "slug is already in use");
      }
    }
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_owner_source", (q) => q.eq("ownerId", authenticatedOwner).eq("sourceId", args.nodeId))
      .unique();
    if (!node) fail("NODE_NOT_FOUND", "node does not exist");
    const document = JSON.parse(node.document) as Entity;
    document.slug = slug;
    await ctx.db.patch(node._id, { slug, document: JSON.stringify(document), updatedAt: new Date().toISOString() });
    return { id: args.nodeId, slug };
  },
});

export const listUsers = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ownerId(ctx);
    if (args.userIds.length > 100) fail("TOO_MANY_USERS", "at most 100 users may be requested");
    const documents: string[] = [];
    for (const id of args.userIds) {
      const user = await ctx.db.query("users").withIndex("by_owner", (q) => q.eq("ownerId", id)).unique();
      if (user) documents.push(user.document);
    }
    return documents;
  },
});

export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const authenticatedOwner = await ownerId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", authenticatedOwner))
      .order("desc")
      .take(MAX_NOTIFICATIONS_PER_USER);
    return rows.map((row) => ({
      id: row._id,
      userId: row.userId,
      messageContent: { mentionedById: row.mentionedById, nodeId: row.nodeId },
      isRead: row.isRead,
      createdAt: row.createdAt,
    }));
  },
});

export const createNotification = mutation({
  args: { userId: v.string(), nodeId: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    boundedId(args.userId, "userId");
    boundedId(args.nodeId, "nodeId");
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      mentionedById: authenticatedOwner,
      nodeId: args.nodeId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    const retainedNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(MAX_NOTIFICATIONS_PER_USER + 1);
    if (retainedNotifications.length > MAX_NOTIFICATIONS_PER_USER) {
      await ctx.db.delete(retainedNotifications[MAX_NOTIFICATIONS_PER_USER]._id);
    }
    return notificationId;
  },
});

export const markNotificationsRead = mutation({
  args: { notificationId: v.optional(v.id("notifications")) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    if (args.notificationId) {
      const row = await ctx.db.get(args.notificationId);
      if (row?.userId === authenticatedOwner) await ctx.db.patch(row._id, { isRead: true });
      return;
    }
    const rows = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", authenticatedOwner)).take(500);
    for (const row of rows) if (!row.isRead) await ctx.db.patch(row._id, { isRead: true });
  },
});

export const getExpansionState = query({
  args: { rootObjectId: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    return ctx.db
      .query("expansionStates")
      .withIndex("by_owner_root", (q) => q.eq("ownerId", authenticatedOwner).eq("rootObjectId", args.rootObjectId))
      .unique();
  },
});

export const saveExpansionState = mutation({
  args: { rootObjectId: v.string(), expandedObjects: v.array(v.string()) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    if (args.expandedObjects.length > 10_000) fail("EXPANSION_LIMIT", "expanded object list exceeds its bound");
    const existing = await ctx.db
      .query("expansionStates")
      .withIndex("by_owner_root", (q) => q.eq("ownerId", authenticatedOwner).eq("rootObjectId", args.rootObjectId))
      .unique();
    const value = { ownerId: authenticatedOwner, ...args, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.replace(existing._id, value);
    else {
      const retained = await ctx.db
        .query("expansionStates")
        .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
        .take(MAX_EXPANSION_STATES_PER_OWNER);
      if (retained.length >= MAX_EXPANSION_STATES_PER_OWNER) {
        fail("EXPANSION_STATE_LIMIT", "expansion state cache reached its 2,000-entry bound");
      }
      await ctx.db.insert("expansionStates", value);
    }
  },
});

export const deleteExpansionState = mutation({
  args: { rootObjectId: v.string() },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    const existing = await ctx.db
      .query("expansionStates")
      .withIndex("by_owner_root", (q) => q.eq("ownerId", authenticatedOwner).eq("rootObjectId", args.rootObjectId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const readCanonicalPaths = query({
  args: { objectIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    if (args.objectIds.length > 100) fail("CACHE_READ_LIMIT", "at most 100 cache entries may be read");
    const rows = [];
    for (const objectId of args.objectIds) {
      const row = await ctx.db
        .query("canonicalPaths")
        .withIndex("by_owner_object", (q) => q.eq("ownerId", authenticatedOwner).eq("objectId", objectId))
        .unique();
      if (row) rows.push({ objectId: row.objectId, ancestors: row.ancestors });
    }
    return rows;
  },
});

export const writeCanonicalPaths = mutation({
  args: {
    entries: v.array(v.object({
      objectId: v.string(),
      ancestors: v.array(v.object({ id: v.string(), label: v.string() })),
    })),
  },
  handler: async (ctx, args) => {
    const authenticatedOwner = await ownerId(ctx);
    if (args.entries.length > 100) fail("CACHE_WRITE_LIMIT", "at most 100 cache entries may be written");
    const retained = await ctx.db
      .query("canonicalPaths")
      .withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner))
      .take(MAX_CANONICAL_PATHS_PER_OWNER);
    let remainingCapacity = MAX_CANONICAL_PATHS_PER_OWNER - retained.length;
    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("canonicalPaths")
        .withIndex("by_owner_object", (q) => q.eq("ownerId", authenticatedOwner).eq("objectId", entry.objectId))
        .unique();
      const value = { ownerId: authenticatedOwner, ...entry, updatedAt: new Date().toISOString() };
      if (existing) await ctx.db.replace(existing._id, value);
      else {
        if (remainingCapacity <= 0) fail("CACHE_ENTRY_LIMIT", "canonical path cache reached its 2,000-entry bound");
        await ctx.db.insert("canonicalPaths", value);
        remainingCapacity--;
      }
    }
  },
});

export const deleteOwnerDataPage = mutation({
  args: {},
  handler: async (ctx) => {
    const authenticatedOwner = await ownerId(ctx);
    const tables = ["nodes", "relations", "relationTypes", "relationLists"] as const;
    let deleted = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).withIndex("by_owner", (q) => q.eq("ownerId", authenticatedOwner)).take(125);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted, hasMore: deleted === 500 };
  },
});
