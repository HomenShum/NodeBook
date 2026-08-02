/// <reference types="vite/client" />
import { createHash } from "node:crypto";

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/!(*.test).*s");
const applySync = makeFunctionReference<"mutation", { payload: string }, any>("graph:applySync");
const snapshotPage = makeFunctionReference<
  "query",
  {
    table: "nodes" | "relationLists";
    visibility: "owned" | "public";
    cursor: null;
    limit?: number;
  },
  any
>("graph:snapshotPage");
const importBatch = makeFunctionReference<"mutation", any, any>("migration:importBatch");
const clearOwnerGraph = makeFunctionReference<"mutation", any, any>("migration:clearOwnerGraph");
const recentTransactions = makeFunctionReference<
  "query",
  { ownerCursor: string; publicCursor: string; limit?: number },
  any
>("graph:recentTransactions");
const recordAgentRun = makeFunctionReference<"mutation", any, any>("agentRuns:record");
const recentAgentRuns = makeFunctionReference<"query", { limit?: number }, any[]>("agentRuns:recent");
const beginChunkedNodeUpdate = makeFunctionReference<"mutation", any, any>("chunkedNodeUpdates:begin");
const uploadChunkedNodePart = makeFunctionReference<"mutation", any, any>("chunkedNodeUpdates:uploadPart");
const finalizeChunkedNodeUpdate = makeFunctionReference<"mutation", any, any>("chunkedNodeUpdates:finalize");

const owner = "auth0|owner-a";
const otherOwner = "auth0|owner-b";
const baseNode = {
  id: "node-1",
  authorId: owner,
  version: 1,
  isPublic: false,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  content: [{ type: "text", value: "Production note" }],
  isNewRelatedObjectsPublic: false,
  canonicalRelationId: null,
  isChecked: false,
  accessMode: 0,
  attributes: {},
};

function syncPayload(transactionId: string, updates: unknown[], userId = owner) {
  return JSON.stringify({ clientId: "browser-a", userId, transactionId, updates });
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

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uploadMetadata(transactionId: string, oldEntity: unknown, newEntity: typeof baseNode) {
  const document = JSON.stringify(newEntity);
  const chunks = document.match(/[\s\S]{1,96000}/g) ?? [];
  const metadata = {
    uploadId: `node:${transactionId}`,
    transactionId,
    clientId: "browser-a",
    nodeId: newEntity.id,
    expectedVersion: (oldEntity as { version: number }).version,
    targetVersion: newEntity.version,
    oldEntityHash: hash(canonicalEntityForCas(oldEntity as Record<string, unknown>)),
    newDocumentDigest: hash(document),
    chunkCount: chunks.length,
    totalBytes: Buffer.byteLength(document),
  };
  return { chunks, metadata: { ...metadata, metadataHash: hash(canonical(metadata)) } };
}

describe("NodeBook Convex production contract", () => {
  afterEach(() => vi.restoreAllMocks());

  test("owner writing from a laptop gets idempotent atomic replay and private isolation", async () => {
    const database = convexTest(schema, modules);
    const t = database.withIdentity({ subject: owner });
    const payload = syncPayload("tx-create", [{ operation: "addNode", node: baseNode }]);
    expect(await t.mutation(applySync, { payload })).toMatchObject({ status: "ok", replayed: false, applied: 1 });
    expect(await t.mutation(applySync, { payload })).toMatchObject({ status: "ok", replayed: true, applied: 1 });
    await expect(
      t.mutation(applySync, {
        payload: syncPayload("tx-create", [{ operation: "deleteNode", node: baseNode }]),
      }),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    const privatePage = await t.query(snapshotPage, {
      table: "nodes",
      visibility: "owned",
      cursor: null,
      limit: 10,
    });
    expect(privatePage.items).toHaveLength(1);
    const other = database.withIdentity({ subject: otherOwner });
    const otherPage = await other.query(snapshotPage, {
      table: "nodes",
      visibility: "owned",
      cursor: null,
      limit: 10,
    });
    expect(otherPage.items).toHaveLength(0);
  });

  test("an owner opening a migrated oversized note receives the verified reassembled document", async () => {
    const database = convexTest(schema, modules);
    const fullDocument = JSON.stringify({ ...baseNode, content: [{ type: "text", value: "A".repeat(2_000) }] });
    const chunks = [fullDocument.slice(0, 900), fullDocument.slice(900)];
    const marker = JSON.stringify({
      __nodebookChunked: true,
      chunkCount: chunks.length,
      documentDigest: createHash("sha256").update(fullDocument).digest("hex"),
      id: baseNode.id,
      authorId: owner,
      version: 1,
      isPublic: false,
    });
    await database.run(async (ctx) => {
      await ctx.db.insert("nodes", {
        ownerId: owner,
        sourceId: baseNode.id,
        version: 1,
        isPublic: false,
        document: marker,
        updatedAt: baseNode.updatedAt,
      });
      for (const [chunkIndex, document] of chunks.entries()) {
        await ctx.db.insert("nodeChunks", {
          ownerId: owner,
          sourceId: `${baseNode.id}\u001f${chunkIndex}`,
          nodeId: baseNode.id,
          chunkIndex,
          document,
          updatedAt: baseNode.updatedAt,
        });
      }
    });
    const page = await database.withIdentity({ subject: owner }).query(snapshotPage, {
      table: "nodes",
      visibility: "owned",
      cursor: null,
      limit: 10,
    });
    expect(page.items).toEqual([fullDocument]);
  });

  test("an owner edits a 2.12 MiB migrated note with verified chunks and idempotent finalize", async () => {
    const database = convexTest(schema, modules);
    const oldEntity = { ...baseNode, content: [{ type: "text", value: "A".repeat(2_120_000) }] };
    const oldDocument = JSON.stringify(oldEntity);
    const migratedDocument = JSON.stringify({ ...oldEntity, slug: "legacy-slug" });
    const oldChunks = migratedDocument.match(/[\s\S]{1,100000}/g) ?? [];
    await database.run(async (ctx) => {
      await ctx.db.insert("nodes", {
        ownerId: owner,
        sourceId: oldEntity.id,
        version: 1,
        isPublic: false,
        document: JSON.stringify({
          __nodebookChunked: true,
          chunkCount: oldChunks.length,
          documentDigest: hash(migratedDocument),
          id: oldEntity.id,
          authorId: owner,
          version: 1,
          isPublic: false,
        }),
        slug: "legacy-slug",
        updatedAt: oldEntity.updatedAt,
      });
      for (const [chunkIndex, document] of oldChunks.entries()) {
        await ctx.db.insert("nodeChunks", {
          ownerId: owner,
          sourceId: `${oldEntity.id}:${chunkIndex}`,
          nodeId: oldEntity.id,
          chunkIndex,
          document,
          updatedAt: oldEntity.updatedAt,
        });
      }
    });
    const newEntity = {
      ...oldEntity,
      version: 2,
      updatedAt: "2026-07-30T00:00:01.000Z",
      content: [{ type: "text", value: `${"A".repeat(2_119_990)} edited` }],
    };
    const { chunks, metadata } = uploadMetadata("tx-large-edit", oldEntity, newEntity);
    const session = database.withIdentity({ subject: owner });
    await session.mutation(beginChunkedNodeUpdate, metadata);
    for (const [chunkIndex, document] of chunks.entries()) {
      await session.mutation(uploadChunkedNodePart, {
        uploadId: metadata.uploadId,
        chunkIndex,
        document,
        digest: hash(document),
      });
    }
    expect(await session.mutation(finalizeChunkedNodeUpdate, { uploadId: metadata.uploadId }))
      .toMatchObject({ status: "ok", replayed: false, applied: 1 });
    expect(await session.mutation(finalizeChunkedNodeUpdate, { uploadId: metadata.uploadId }))
      .toMatchObject({ status: "ok", replayed: true, applied: 1 });
    const page = await session.query(snapshotPage, { table: "nodes", visibility: "owned", cursor: null, limit: 10 });
    expect(hash(page.items[0])).toBe(hash(JSON.stringify(newEntity)));
    expect(JSON.parse(page.items[0]).version).toBe(2);
    expect(await database.run(async (ctx) => (await ctx.db.query("nodes").first())?.slug)).toBe("legacy-slug");

    const undo = uploadMetadata("tx-large-undo", newEntity, oldEntity);
    await session.mutation(beginChunkedNodeUpdate, undo.metadata);
    for (const [chunkIndex, document] of undo.chunks.entries()) {
      await session.mutation(uploadChunkedNodePart, {
        uploadId: undo.metadata.uploadId,
        chunkIndex,
        document,
        digest: hash(document),
      });
    }
    await session.mutation(finalizeChunkedNodeUpdate, { uploadId: undo.metadata.uploadId });
    const undonePage = await session.query(snapshotPage, { table: "nodes", visibility: "owned", cursor: null, limit: 10 });
    expect(hash(undonePage.items[0])).toBe(hash(oldDocument));
    expect(JSON.parse(undonePage.items[0]).version).toBe(1);
  });

  test("missing or corrupt upload parts fail without changing the live node", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: owner });
    await session.mutation(applySync, {
      payload: syncPayload("tx-create-before-incomplete-upload", [{ operation: "addNode", node: baseNode }]),
    });
    const newEntity = {
      ...baseNode,
      version: 2,
      updatedAt: "2026-07-30T00:00:01.000Z",
      content: [{ type: "text", value: "B".repeat(210_000) }],
    };
    const { chunks, metadata } = uploadMetadata("tx-incomplete", baseNode, newEntity);
    await session.mutation(beginChunkedNodeUpdate, metadata);
    await session.mutation(uploadChunkedNodePart, {
      uploadId: metadata.uploadId,
      chunkIndex: 0,
      document: chunks[0]!,
      digest: hash(chunks[0]!),
    });
    await expect(session.mutation(finalizeChunkedNodeUpdate, { uploadId: metadata.uploadId }))
      .rejects.toThrow(/UPLOAD_INCOMPLETE/);
    await expect(session.mutation(uploadChunkedNodePart, {
      uploadId: metadata.uploadId,
      chunkIndex: 1,
      document: chunks[1]!,
      digest: "0".repeat(64),
    })).rejects.toThrow(/DIGEST_MISMATCH/);
    const page = await session.query(snapshotPage, { table: "nodes", visibility: "owned", cursor: null, limit: 10 });
    expect(JSON.parse(page.items[0]).version).toBe(1);
  });

  test("two tabs finalizing oversized edits preserve one CAS winner", async () => {
    const session = convexTest(schema, modules).withIdentity({ subject: owner });
    await session.mutation(applySync, { payload: syncPayload("tx-create-for-large-race", [{ operation: "addNode", node: baseNode }]) });
    const candidates = ["A", "B"].map((label) => ({
      ...baseNode,
      version: 2,
      updatedAt: "2026-07-30T00:00:01.000Z",
      content: [{ type: "text", value: label.repeat(210_000) }],
    }));
    const uploads = candidates.map((candidate, index) => uploadMetadata(`tx-large-tab-${index}`, baseNode, candidate));
    for (const { chunks, metadata } of uploads) {
      await session.mutation(beginChunkedNodeUpdate, metadata);
      for (const [chunkIndex, document] of chunks.entries()) {
        await session.mutation(uploadChunkedNodePart, { uploadId: metadata.uploadId, chunkIndex, document, digest: hash(document) });
      }
    }
    const outcomes = await Promise.allSettled(
      uploads.map(({ metadata }) => session.mutation(finalizeChunkedNodeUpdate, { uploadId: metadata.uploadId })),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  test("two tabs editing the same note surface one winner and one honest version conflict", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    await t.mutation(applySync, {
      payload: syncPayload("tx-create", [{ operation: "addNode", node: baseNode }]),
    });
    const update = (transactionId: string, value: string) =>
      t.mutation(applySync, {
        payload: syncPayload(transactionId, [{
          operation: "updateNode",
          oldProps: baseNode,
          newProps: {
            ...baseNode,
            version: 2,
            updatedAt: "2026-07-30T00:00:01.000Z",
            content: [{ type: "text", value }],
          },
        }]),
      });
    const outcomes = await Promise.allSettled([update("tx-tab-a", "Tab A"), update("tx-tab-b", "Tab B")]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  test("a new owner's bootstrap can update only derived graph state at the creation version", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    const derivedNode = {
      ...baseNode,
      relationCount: 1,
      canonicalRelationId: "relation-1",
      updatedAt: "2026-07-30T00:00:01.000Z",
    };
    await expect(t.mutation(applySync, {
      payload: syncPayload("tx-bootstrap", [
        { operation: "addNode", node: baseNode },
        { operation: "updateNode", oldProps: baseNode, newProps: derivedNode },
      ]),
    })).resolves.toMatchObject({ status: "ok", applied: 2 });

    await expect(t.mutation(applySync, {
      payload: syncPayload("tx-same-version-content-tamper", [{
        operation: "updateNode",
        oldProps: derivedNode,
        newProps: {
          ...derivedNode,
          content: [{ type: "text", value: "Changed without a version advance" }],
        },
      }]),
    })).rejects.toThrow(/INVALID_VERSION/);
  });

  test("a migrated slug survives a same-version derived update from a client that does not serialize slugs", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    await t.mutation(applySync, {
      payload: syncPayload("tx-slug-create", [{ operation: "addNode", node: { ...baseNode, slug: "legacy-slug" } }]),
    });
    await expect(t.mutation(applySync, {
      payload: syncPayload("tx-slug-derived", [{
        operation: "updateNode",
        oldProps: baseNode,
        newProps: { ...baseNode, relationCount: 1, updatedAt: "2026-07-30T00:00:01.000Z" },
      }]),
    })).resolves.toMatchObject({ status: "ok", applied: 1 });

    const page = await t.query(snapshotPage, { table: "nodes", visibility: "owned", cursor: null, limit: 10 });
    const stored = JSON.parse(page.items[0]);
    expect(stored).toMatchObject({ slug: "legacy-slug", relationCount: 1 });
  });

  test("undo removes relation-list positions instead of persisting invalid null tombstones", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    const positioned = {
      operation: "updateRelationList",
      authorId: owner,
      nodeId: "root",
      relationId: "relation-1",
      type: "all",
      newPosition: { int: 1, frac: "a" },
      newIsPublic: false,
    };
    await t.mutation(applySync, {
      payload: syncPayload("tx-position", [positioned]),
    });
    await t.mutation(applySync, {
      payload: syncPayload("tx-unposition", [{ ...positioned, newPosition: null }]),
    });
    const page = await t.query(snapshotPage, {
      table: "relationLists",
      visibility: "owned",
      cursor: null,
      limit: 10,
    });
    expect(page.items).toEqual([]);
  });

  test("two owners publishing in the same millisecond remain visible on independent realtime cursors", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const database = convexTest(schema, modules);
    const ownerSession = database.withIdentity({ subject: owner });
    const otherSession = database.withIdentity({ subject: otherOwner });
    const publicNode = { ...baseNode, isPublic: true };
    await ownerSession.mutation(applySync, {
      payload: syncPayload("tx-owner-public", [{ operation: "addNode", node: publicNode }]),
    });
    await otherSession.mutation(applySync, {
      payload: syncPayload(
        "tx-other-public",
        [{ operation: "addNode", node: { ...publicNode, id: "node-2", authorId: otherOwner } }],
        otherOwner,
      ),
    });

    const first = await ownerSession.query(recentTransactions, {
      ownerCursor: "0000000000000000",
      publicCursor: "0000000000000000",
      limit: 20,
    });
    expect(first.own).toHaveLength(1);
    expect(first.shared).toHaveLength(2);
    expect(first.shared.filter((entry: { payload: string | null }) => entry.payload !== null)).toHaveLength(1);

    const second = await ownerSession.query(recentTransactions, {
      ownerCursor: first.own.at(-1).cursor,
      publicCursor: first.shared.at(-1).cursor,
      limit: 20,
    });
    expect(second).toEqual({ own: [], shared: [] });
  });

  test("an adversarial client cannot write another owner's graph or exceed the burst bound", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    await expect(
      t.mutation(applySync, {
        payload: syncPayload("tx-cross-owner", [{
          operation: "addNode",
          node: { ...baseNode, authorId: otherOwner },
        }]),
      }),
    ).rejects.toThrow(/OWNER_MISMATCH/);
    const oversized = Array.from({ length: 501 }, (_, index) => ({
      operation: "addNode",
      node: { ...baseNode, id: `node-${index}` },
    }));
    await expect(
      t.mutation(applySync, { payload: syncPayload("tx-oversized", oversized) }),
    ).rejects.toThrow(/INVALID_SYNC|SYNC_TOO_LARGE/);
  });

  test("a sustained editing session preserves every sequential version without score or status shortcuts", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: owner });
    await t.mutation(applySync, {
      payload: syncPayload("tx-create", [{ operation: "addNode", node: baseNode }]),
    });
    let current = baseNode;
    for (let version = 2; version <= 52; version++) {
      const next = {
        ...current,
        version,
        updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
        content: [{ type: "text", value: `Sustained edit ${version}` }],
      };
      await t.mutation(applySync, {
        payload: syncPayload(`tx-${version}`, [{ operation: "updateNode", oldProps: current, newProps: next }]),
      });
      current = next;
    }
    const page = await t.query(snapshotPage, {
      table: "nodes",
      visibility: "owned",
      cursor: null,
      limit: 10,
    });
    expect(JSON.parse(page.items[0]).version).toBe(52);
  });

  test("an operator replaying a migration batch gets the same receipt while divergent replay is blocked", async () => {
    const t = convexTest(schema, modules);
    const rowsJson = JSON.stringify([{
      ownerId: owner,
      sourceId: baseNode.id,
      version: 1,
      isPublic: false,
      document: JSON.stringify(baseNode),
      updatedAt: baseNode.updatedAt,
    }]);
    const digest = createHash("sha256").update(rowsJson).digest("hex");
    const args = {
      sourceKey: "source-export-1",
      batchKey: "nodes:0",
      digest,
      table: "nodes",
      rowsJson,
    };
    expect(await t.mutation(importBatch, args)).toMatchObject({ status: "ok", replayed: false, imported: 1 });
    expect(await t.mutation(importBatch, args)).toMatchObject({ status: "ok", replayed: true, imported: 1 });
    const clockOnlyRows = JSON.stringify([{ ...JSON.parse(rowsJson)[0], updatedAt: "2026-07-31T00:00:00.000Z" }]);
    expect(
      await t.mutation(importBatch, {
        ...args,
        rowsJson: clockOnlyRows,
        digest: createHash("sha256").update(clockOnlyRows).digest("hex"),
      }),
    ).toMatchObject({ status: "ok", replayed: true, imported: 1 });
    const changedRows = JSON.stringify([{ ...JSON.parse(rowsJson)[0], document: JSON.stringify({ ...baseNode, version: 2 }) }]);
    await expect(
      t.mutation(importBatch, {
        ...args,
        rowsJson: changedRows,
        digest: createHash("sha256").update(changedRows).digest("hex"),
      }),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    await expect(
      t.mutation(importBatch, { ...args, digest: "0".repeat(64) }),
    ).rejects.toThrow(/DIGEST_MISMATCH|IDEMPOTENCY_CONFLICT/);
  });

  test("a cutover operator can clear only an exactly matched staging graph before the first migration batch", async () => {
    const database = convexTest(schema, modules);
    await database.run(async (ctx) => {
      await ctx.db.insert("users", { ownerId: owner, document: JSON.stringify({ id: owner }), updatedAt: baseNode.updatedAt });
      await ctx.db.insert("nodes", {
        ownerId: owner,
        sourceId: baseNode.id,
        version: 1,
        isPublic: false,
        document: JSON.stringify(baseNode),
        updatedAt: baseNode.updatedAt,
      });
      await ctx.db.insert("nodes", {
        ownerId: otherOwner,
        sourceId: "other-node",
        version: 1,
        isPublic: false,
        document: JSON.stringify({ ...baseNode, id: "other-node", authorId: otherOwner }),
        updatedAt: baseNode.updatedAt,
      });
    });
    const expected = { users: 1, nodes: 1, relations: 0, relationTypes: 0, relationLists: 0 };
    await expect(
      database.mutation(clearOwnerGraph, {
        operationId: "cutover-owner-a",
        ownerId: owner,
        expected: { ...expected, nodes: 2 },
      }),
    ).rejects.toThrow(/RESET_PRECONDITION_FAILED/);

    expect(
      await database.mutation(clearOwnerGraph, { operationId: "cutover-owner-a", ownerId: owner, expected }),
    ).toMatchObject({ status: "ok", replayed: false, deletedUsers: 1, deletedNodes: 1 });
    expect(
      await database.mutation(clearOwnerGraph, { operationId: "cutover-owner-a", ownerId: owner, expected }),
    ).toMatchObject({ status: "ok", replayed: true, deletedUsers: 1, deletedNodes: 1 });
    const survivingOwners = await database.run(async (ctx) => (await ctx.db.query("nodes").collect()).map((row) => row.ownerId));
    expect(survivingOwners).toEqual([otherOwner]);
  });

  test("a sustained agent user retains a bounded private receipt ledger with idempotent run IDs", async () => {
    const database = convexTest(schema, modules);
    const ownerSession = database.withIdentity({ subject: owner });
    const record = (index: number) => ({
      runId: `run-${index}`,
      status: "completed" as const,
      provider: "openai" as const,
      model: "gpt-5-mini",
      mode: "read-only" as const,
      query: `Question ${index}`,
      sourceNodeIds: [`node-${index}`],
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      startedAt: new Date(index).toISOString(),
      completedAt: new Date(index + 1).toISOString(),
      startedAtMs: index,
    });
    await database.run(async (ctx) => {
      for (let index = 0; index < 200; index++) {
        await ctx.db.insert("agentRuns", { ownerId: owner, ...record(index) });
      }
    });
    await ownerSession.mutation(recordAgentRun, record(200));
    await ownerSession.mutation(recordAgentRun, record(200));

    const recent = await ownerSession.query(recentAgentRuns, { limit: 50 });
    expect(recent).toHaveLength(50);
    expect(recent[0].runId).toBe("run-200");
    const retained = await database.run(async (ctx) =>
      ctx.db
        .query("agentRuns")
        .withIndex("by_owner_started", (q) => q.eq("ownerId", owner))
        .collect(),
    );
    expect(retained).toHaveLength(200);
    expect(retained.some((run) => run.runId === "run-0")).toBe(false);
    const otherSession = database.withIdentity({ subject: otherOwner });
    expect(await otherSession.query(recentAgentRuns, { limit: 50 })).toEqual([]);
  });
});
