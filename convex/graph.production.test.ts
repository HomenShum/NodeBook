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
const recentTransactions = makeFunctionReference<
  "query",
  { ownerCursor: string; publicCursor: string; limit?: number },
  any
>("graph:recentTransactions");
const recordAgentRun = makeFunctionReference<"mutation", any, any>("agentRuns:record");
const recentAgentRuns = makeFunctionReference<"query", { limit?: number }, any[]>("agentRuns:recent");

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
    await expect(
      t.mutation(importBatch, { ...args, digest: "0".repeat(64) }),
    ).rejects.toThrow(/DIGEST_MISMATCH|IDEMPOTENCY_CONFLICT/);
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
