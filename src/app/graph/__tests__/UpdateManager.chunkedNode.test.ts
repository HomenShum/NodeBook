import { createHash, webcrypto } from "node:crypto";
import { ReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from "node:util";

import { UpdateManager } from "@/app/graph/UpdateManager";
import { SyncData } from "@/app/graph/SyncData";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, "TextEncoder", { value: NodeTextEncoder, configurable: true });
Object.defineProperty(globalThis, "TextDecoder", { value: NodeTextDecoder, configurable: true });

function response(body: string, status: number) {
  const bytes = new NodeTextEncoder().encode(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  } as unknown as Response;
}

function node(version: number, value: string) {
  const createdAt = new Date("2026-07-30T00:00:00.000Z");
  return {
    id: "large-node",
    authorId: "auth0|owner-a",
    version,
    createdAt,
    updatedAt: new Date(createdAt.getTime() + version * 1_000),
    content: [{ type: "text" as const, value }],
    isPublic: false,
    isNewRelatedObjectsPublic: false,
    canonicalRelationId: null,
    isChecked: false,
    accessMode: 0,
    attributes: {},
  };
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

describe("oversized note sync", () => {
  test("an agent checkpoint does not report durable success after a rejected graph batch", async () => {
    const oldProps = node(1, "before");
    const newProps = node(2, "after");
    const syncData: SyncData = {
      clientId: "browser-a",
      userId: oldProps.authorId,
      transactionId: "tx-agent-durable",
      updates: [{ operation: "updateNode", oldProps, newProps }],
    };
    let syncAttempts = 0;
    const refetch = jest.fn();
    const authedFetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/sync") {
        syncAttempts += 1;
        return response("conflict", 409);
      }
      return response(JSON.stringify({
        status: "ok",
        data: { items: [], continueCursor: "", isDone: true },
      }), 200);
    }) as unknown as typeof fetch;
    const manager = new UpdateManager(oldProps.authorId, refetch, jest.fn(), jest.fn(), jest.fn(), authedFetch);

    await manager.beginDurableWork();
    manager.syncQueue.push(syncData);

    await expect(manager.flushDurableUpdates()).rejects.toThrow("Graph sync failed (409)");
    expect(syncAttempts).toBe(4);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(manager.pendingUpdates).toEqual([]);
  });

  test("a writer uploads bounded parts and finalizes before reporting success", async () => {
    const oldProps = node(1, "A".repeat(210_000));
    const newProps = node(2, "B".repeat(210_000));
    const syncData: SyncData = {
      clientId: "browser-a",
      userId: oldProps.authorId,
      transactionId: "tx-large",
      updates: [{ operation: "updateNode", oldProps, newProps }],
    };
    const bodies: any[] = [];
    const authedFetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const manager = new UpdateManager(oldProps.authorId, jest.fn(), jest.fn(), jest.fn(), jest.fn(), authedFetch);
    manager.syncQueue.push(syncData);

    await manager.syncLocalUpdates(authedFetch);

    expect(bodies[0]).toMatchObject({ phase: "start", nodeId: oldProps.id, expectedVersion: 1, targetVersion: 2 });
    const serverShapedOldProps = JSON.parse(JSON.stringify(oldProps));
    expect(bodies[0].oldEntityHash).toBe(
      createHash("sha256").update(canonicalEntityForCas(serverShapedOldProps)).digest("hex"),
    );
    expect(bodies.at(-1)).toEqual({ phase: "finalize", uploadId: "node:tx-large" });
    const parts = bodies.filter((body) => body.phase === "part");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => Buffer.byteLength(part.document) <= 96 * 1024)).toBe(true);
    expect(parts.map((part) => part.document).join("")).toBe(JSON.stringify(newProps));
    expect(manager.pendingUpdates).toEqual([]);
  });

  test("a failed part is retried idempotently and never finalized early", async () => {
    const oldProps = node(1, "A".repeat(210_000));
    const newProps = node(2, "B".repeat(210_000));
    const syncData: SyncData = {
      clientId: "browser-a",
      userId: oldProps.authorId,
      transactionId: "tx-retry",
      updates: [{ operation: "updateNode", oldProps, newProps }],
    };
    let failed = false;
    const bodies: any[] = [];
    const authedFetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      if (!failed && body.phase === "part" && body.chunkIndex === 1) {
        failed = true;
        return { ok: false } as Response;
      }
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const manager = new UpdateManager(oldProps.authorId, jest.fn(), jest.fn(), jest.fn(), jest.fn(), authedFetch);
    manager.syncQueue.push(syncData);

    await manager.syncLocalUpdates(authedFetch);

    expect(bodies.filter((body) => body.phase === "start")).toHaveLength(2);
    expect(bodies.filter((body) => body.phase === "finalize")).toHaveLength(1);
    expect(manager.offlineSince).toBeNull();
  });
});
