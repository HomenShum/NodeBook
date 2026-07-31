import { ConvexError, v } from "convex/values";

import { hydrateNodeDocument, MAX_NODE_CHUNKS, MAX_NODE_DOCUMENT_BYTES } from "./nodeDocuments";
import { mutation, type MutationCtx } from "./server";

const MAX_ACTIVE_UPLOADS = 8;
const MAX_CHUNK_BYTES = 128 * 1024;
const UPLOAD_TTL_MS = 15 * 60_000;
const MAX_SYNC_TRANSACTIONS_PER_OWNER = 1_000;
const MAX_SYNC_FEED_ITEMS_PER_OWNER = 20;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

type Entity = {
  id: string;
  authorId: string;
  version: number;
  isPublic?: boolean;
  slug?: string | null;
  content?: unknown;
};

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function canonicalEntityForCas(entity: Record<string, unknown>) {
  const {
    canonicalRelationId: _canonicalRelationId,
    relationCount: _relationCount,
    slug: _slug,
    updatedAt: _updatedAt,
    ...stable
  } = entity;
  return canonical(stable);
}

async function ownerId(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) fail("AUTH_REQUIRED", "an authenticated identity is required");
  return identity.subject;
}

function boundedId(value: string, field: string) {
  if (!value || value.length > 2_048) fail("INVALID_UPLOAD", `${field} must be bounded non-empty text`);
}

function assertHash(value: string, field: string) {
  if (!HASH_PATTERN.test(value)) fail("INVALID_UPLOAD", `${field} must be a SHA-256 digest`);
}

function entityContentText(entity: Entity) {
  if (!Array.isArray(entity.content)) return "";
  return entity.content
    .map((part) => part && typeof part === "object" && typeof (part as { value?: unknown }).value === "string"
      ? String((part as { value: string }).value)
      : "")
    .join(" ")
    .slice(0, 32_768);
}

async function removeUpload(ctx: MutationCtx, owner: string, uploadId: string) {
  const parts = await ctx.db
    .query("chunkedNodeWriteParts")
    .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", uploadId))
    .take(MAX_NODE_CHUNKS + 1);
  if (parts.length > MAX_NODE_CHUNKS) fail("UPLOAD_CORRUPT", "upload has too many persisted parts");
  for (const part of parts) await ctx.db.delete(part._id);
  const session = await ctx.db
    .query("chunkedNodeWriteSessions")
    .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", uploadId))
    .unique();
  if (session) await ctx.db.delete(session._id);
}

const startArgs = {
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
};

export const begin = mutation({
  args: startArgs,
  handler: async (ctx, args) => {
    const owner = await ownerId(ctx);
    for (const [field, value] of Object.entries({
      uploadId: args.uploadId,
      transactionId: args.transactionId,
      clientId: args.clientId,
      nodeId: args.nodeId,
    })) boundedId(value, field);
    assertHash(args.oldEntityHash, "oldEntityHash");
    assertHash(args.newDocumentDigest, "newDocumentDigest");
    assertHash(args.metadataHash, "metadataHash");
    if (
      !Number.isSafeInteger(args.expectedVersion)
      || args.expectedVersion < 1
      || !Number.isSafeInteger(args.targetVersion)
      || args.targetVersion < 1
      || Math.abs(args.targetVersion - args.expectedVersion) !== 1
    ) {
      fail("INVALID_VERSION", "chunked update must move the node by exactly one version");
    }
    if (!Number.isSafeInteger(args.chunkCount) || args.chunkCount < 1 || args.chunkCount > MAX_NODE_CHUNKS) {
      fail("INVALID_UPLOAD", `chunkCount must be between 1 and ${MAX_NODE_CHUNKS}`);
    }
    if (!Number.isSafeInteger(args.totalBytes) || args.totalBytes < 1 || args.totalBytes > MAX_NODE_DOCUMENT_BYTES) {
      fail("ENTITY_TOO_LARGE", "chunked node exceeds the 4 MiB document budget");
    }
    const calculatedMetadataHash = await sha256(canonical({
      uploadId: args.uploadId,
      transactionId: args.transactionId,
      clientId: args.clientId,
      nodeId: args.nodeId,
      expectedVersion: args.expectedVersion,
      targetVersion: args.targetVersion,
      oldEntityHash: args.oldEntityHash,
      newDocumentDigest: args.newDocumentDigest,
      chunkCount: args.chunkCount,
      totalBytes: args.totalBytes,
    }));
    if (calculatedMetadataHash !== args.metadataHash) fail("DIGEST_MISMATCH", "upload metadata digest mismatch");

    const applied = await ctx.db
      .query("syncTransactions")
      .withIndex("by_owner_transaction", (q) => q.eq("ownerId", owner).eq("transactionId", args.transactionId))
      .unique();
    if (applied) {
      if (applied.payloadHash !== args.metadataHash) fail("IDEMPOTENCY_CONFLICT", "transaction id was reused");
      return { status: "ok" as const, replayed: true };
    }
    const existing = await ctx.db
      .query("chunkedNodeWriteSessions")
      .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", args.uploadId))
      .unique();
    if (existing) {
      if (existing.metadataHash !== args.metadataHash) fail("IDEMPOTENCY_CONFLICT", "upload id was reused");
      return { status: "ok" as const, replayed: true };
    }

    const now = Date.now();
    const sessions = await ctx.db
      .query("chunkedNodeWriteSessions")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", owner))
      .order("asc")
      .take(MAX_ACTIVE_UPLOADS + 1);
    const expired = sessions.filter((session) => session.expiresAtMs <= now);
    for (const session of expired) await removeUpload(ctx, owner, session.uploadId);
    if (sessions.length - expired.length >= MAX_ACTIVE_UPLOADS) {
      fail("UPLOAD_CAPACITY", "too many active chunked node uploads");
    }

    await ctx.db.insert("chunkedNodeWriteSessions", {
      ownerId: owner,
      ...args,
      status: "pending",
      createdAtMs: now,
      expiresAtMs: now + UPLOAD_TTL_MS,
    });
    return { status: "ok" as const, replayed: false };
  },
});

export const uploadPart = mutation({
  args: {
    uploadId: v.string(),
    chunkIndex: v.number(),
    document: v.string(),
    digest: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await ownerId(ctx);
    boundedId(args.uploadId, "uploadId");
    assertHash(args.digest, "digest");
    const session = await ctx.db
      .query("chunkedNodeWriteSessions")
      .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", args.uploadId))
      .unique();
    if (!session) fail("UPLOAD_NOT_FOUND", "chunked node upload was not started");
    if (session.status === "finalized") return { status: "ok" as const, replayed: true };
    if (session.expiresAtMs <= Date.now()) fail("UPLOAD_EXPIRED", "chunked node upload expired");
    if (!Number.isSafeInteger(args.chunkIndex) || args.chunkIndex < 0 || args.chunkIndex >= session.chunkCount) {
      fail("INVALID_UPLOAD", "chunk index is outside the declared range");
    }
    const bytes = utf8Bytes(args.document);
    if (bytes < 1 || bytes > MAX_CHUNK_BYTES) fail("CHUNK_TOO_LARGE", "upload part exceeds 128 KiB");
    if (await sha256(args.document) !== args.digest) fail("DIGEST_MISMATCH", "upload part digest mismatch");
    const sourceId = `${args.uploadId}:${args.chunkIndex}`;
    const existing = await ctx.db
      .query("chunkedNodeWriteParts")
      .withIndex("by_owner_source", (q) => q.eq("ownerId", owner).eq("sourceId", sourceId))
      .unique();
    if (existing) {
      if (existing.digest !== args.digest || existing.document !== args.document) {
        fail("IDEMPOTENCY_CONFLICT", "upload part was replayed with different content");
      }
      return { status: "ok" as const, replayed: true };
    }
    await ctx.db.insert("chunkedNodeWriteParts", {
      ownerId: owner,
      uploadId: args.uploadId,
      sourceId,
      chunkIndex: args.chunkIndex,
      document: args.document,
      digest: args.digest,
      bytes,
    });
    return { status: "ok" as const, replayed: false };
  },
});

export const finalize = mutation({
  args: { uploadId: v.string() },
  handler: async (ctx, args) => {
    const owner = await ownerId(ctx);
    boundedId(args.uploadId, "uploadId");
    const session = await ctx.db
      .query("chunkedNodeWriteSessions")
      .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", args.uploadId))
      .unique();
    if (!session) fail("UPLOAD_NOT_FOUND", "chunked node upload was not started");
    if (session.status === "finalized") return { status: "ok" as const, replayed: true, applied: 1 };
    if (session.expiresAtMs <= Date.now()) fail("UPLOAD_EXPIRED", "chunked node upload expired");
    const parts = await ctx.db
      .query("chunkedNodeWriteParts")
      .withIndex("by_owner_upload", (q) => q.eq("ownerId", owner).eq("uploadId", args.uploadId))
      .take(MAX_NODE_CHUNKS + 1);
    parts.sort((left, right) => left.chunkIndex - right.chunkIndex);
    if (parts.length !== session.chunkCount || parts.some((part, index) => part.chunkIndex !== index)) {
      fail("UPLOAD_INCOMPLETE", "chunked node upload is missing one or more parts");
    }
    const document = parts.map((part) => part.document).join("");
    if (utf8Bytes(document) !== session.totalBytes || await sha256(document) !== session.newDocumentDigest) {
      fail("DIGEST_MISMATCH", "assembled node document does not match upload metadata");
    }
    let entity: Entity;
    try {
      entity = JSON.parse(document) as Entity;
    } catch {
      fail("INVALID_ENTITY", "assembled node document is not valid JSON");
    }
    if (entity.id !== session.nodeId || entity.authorId !== owner || entity.version !== session.targetVersion) {
      fail("INVALID_ENTITY", "assembled node identity or version does not match upload metadata");
    }
    const current = await ctx.db
      .query("nodes")
      .withIndex("by_owner_source", (q) => q.eq("ownerId", owner).eq("sourceId", session.nodeId))
      .unique();
    if (!current || current.version !== session.expectedVersion) fail("VERSION_CONFLICT", "node changed during upload");
    const currentDocument = await hydrateNodeDocument(ctx, current);
    const currentEntity = JSON.parse(currentDocument) as Entity;
    if (await sha256(canonicalEntityForCas(currentEntity as Record<string, unknown>)) !== session.oldEntityHash) {
      fail("VERSION_CONFLICT", "node content changed during upload");
    }

    const existingChunks = await ctx.db
      .query("nodeChunks")
      .withIndex("by_owner_node", (q) => q.eq("ownerId", owner).eq("nodeId", session.nodeId))
      .take(MAX_NODE_CHUNKS + 1);
    if (existingChunks.length > MAX_NODE_CHUNKS) fail("NODE_CHUNKS_CORRUPT", "node has too many existing chunks");
    for (const chunk of existingChunks) await ctx.db.delete(chunk._id);
    const updatedAt = new Date().toISOString();
    for (const part of parts) {
      await ctx.db.insert("nodeChunks", {
        ownerId: owner,
        sourceId: `${session.nodeId}:${part.chunkIndex}`,
        nodeId: session.nodeId,
        chunkIndex: part.chunkIndex,
        document: part.document,
        updatedAt,
      });
    }
    await ctx.db.patch(current._id, {
      version: entity.version,
      isPublic: entity.isPublic === true,
      slug: entity.slug === undefined ? current.slug ?? null : entity.slug,
      contentText: entityContentText(entity),
      document: JSON.stringify({
        __nodebookChunked: true,
        chunkCount: parts.length,
        documentDigest: session.newDocumentDigest,
        id: entity.id,
        authorId: entity.authorId,
        version: entity.version,
        isPublic: entity.isPublic === true,
        slug: entity.slug === undefined ? current.slug ?? null : entity.slug,
      }),
      updatedAt,
    });

    const appliedAtMs = Date.now();
    const event = JSON.stringify({
      kind: "chunkedNodeUpdate",
      clientId: session.clientId,
      userId: owner,
      transactionId: session.transactionId,
      nodeId: session.nodeId,
      version: entity.version,
    });
    await ctx.db.insert("syncTransactions", {
      ownerId: owner,
      transactionId: session.transactionId,
      payloadHash: session.metadataHash,
      updateCount: 1,
      appliedAt: updatedAt,
      appliedAtMs,
    });
    const timestamp = appliedAtMs.toString().padStart(16, "0");
    await ctx.db.insert("syncFeed", {
      ownerId: owner,
      transactionId: session.transactionId,
      ownerStreamKey: `${timestamp}:${session.transactionId}`,
      publicStreamKey: `${timestamp}:${owner}:${session.transactionId}`,
      payload: event,
      publicPayload: entity.isPublic === true ? event : null,
      hasPublicUpdates: entity.isPublic === true,
      appliedAtMs,
    });
    await ctx.db.patch(session._id, { status: "finalized" });

    const transactions = await ctx.db
      .query("syncTransactions")
      .withIndex("by_owner_applied", (q) => q.eq("ownerId", owner))
      .order("desc")
      .take(MAX_SYNC_TRANSACTIONS_PER_OWNER + 1);
    if (transactions.length > MAX_SYNC_TRANSACTIONS_PER_OWNER) await ctx.db.delete(transactions.at(-1)!._id);
    const feed = await ctx.db
      .query("syncFeed")
      .withIndex("by_owner_stream", (q) => q.eq("ownerId", owner))
      .order("desc")
      .take(MAX_SYNC_FEED_ITEMS_PER_OWNER + 1);
    if (feed.length > MAX_SYNC_FEED_ITEMS_PER_OWNER) await ctx.db.delete(feed.at(-1)!._id);
    return { status: "ok" as const, replayed: false, applied: 1 };
  },
});
