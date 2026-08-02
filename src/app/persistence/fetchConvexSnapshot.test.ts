import { TextDecoder as NodeTextDecoder } from "util";

import { fetchConvexSnapshot, pruneUnresolvableRelationPositions } from "./fetchConvexSnapshot";

Object.defineProperty(globalThis, "TextDecoder", { value: NodeTextDecoder, configurable: true });

function responseFor(data: unknown, status = 200): Response {
  const bytes = Buffer.from(JSON.stringify(data), "utf8");
  let consumed = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () => consumed ? { done: true, value: undefined } : ((consumed = true), { done: false, value: bytes }),
        cancel: async () => undefined,
        releaseLock: () => undefined,
      }),
    },
  } as Response;
}

const emptyPage = { status: "ok", data: { items: [], continueCursor: "", isDone: true } };

describe("production-scale Convex snapshot hydration", () => {
  test("a returning owner loads all eight independent table streams concurrently", async () => {
    let active = 0;
    let maxConcurrent = 0;
    const authFetch = jest.fn(async () => {
      active++;
      maxConcurrent = Math.max(maxConcurrent, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return responseFor(emptyPage);
    }) as unknown as typeof fetch;

    const snapshot = await fetchConvexSnapshot(authFetch);

    expect(maxConcurrent).toBe(8);
    expect(authFetch).toHaveBeenCalledTimes(8);
    expect(snapshot.nodesById).toEqual({});
  });

  test("a degraded Convex stream fails honestly instead of returning a partial notebook", async () => {
    const authFetch = jest.fn(async (input: RequestInfo | URL) =>
      String(input).includes("table=relations&visibility=owned")
        ? responseFor({ status: "error" }, 502)
        : responseFor(emptyPage),
    ) as unknown as typeof fetch;

    await expect(fetchConvexSnapshot(authFetch)).rejects.toThrow("HTTP 502");
  });

  test("navigation away aborts every in-flight stream without committing partial state", async () => {
    const controller = new AbortController();
    const authFetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Snapshot aborted", "AbortError")),
          { once: true },
        );
      }),
    ) as unknown as typeof fetch;

    const pending = fetchConvexSnapshot(authFetch, { signal: controller.signal });
    await Promise.resolve();
    controller.abort("route changed");

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(authFetch).toHaveBeenCalledTimes(8);
  });

  test("a malicious endless cursor is stopped by the 100-page stream budget", async () => {
    let cursor = 0;
    const authFetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("table=nodes&visibility=owned")) {
        cursor++;
        return responseFor({ status: "ok", data: { items: [], continueCursor: `cursor-${cursor}`, isDone: false } });
      }
      return responseFor(emptyPage);
    }) as unknown as typeof fetch;

    await expect(fetchConvexSnapshot(authFetch)).rejects.toThrow("exceeded its page budget");
    expect(cursor).toBe(100);
  });

  test("an adversarial fan-out cannot accumulate more than 50,000 documents in memory", async () => {
    const items = Array.from({ length: 6_251 }, () => "{}");
    const authFetch = jest.fn(async () =>
      responseFor({ status: "ok", data: { items, continueCursor: "", isDone: true } }),
    ) as unknown as typeof fetch;

    await expect(fetchConvexSnapshot(authFetch)).rejects.toThrow("50,000-document client budget");
  });

  test("a returning migrated owner prunes inaccessible relation positions only after the full snapshot is assembled", () => {
    const snapshot = {
      usersById: {},
      nodesById: {},
      relationTypesById: {},
      relationsById: { live: { id: "live" } as never },
      relationsByNodeId: {
        root: {
          live: { int: 0, frac: "a0" },
          deleted: { int: 1, frac: "a1" },
        },
      },
      pinnedRelationsByNodeId: {
        root: { private: { int: 0, frac: "a0" } },
      },
      noteContentRelationsByNodeId: {},
    };

    expect(pruneUnresolvableRelationPositions(snapshot)).toBe(2);
    expect(snapshot.relationsByNodeId).toEqual({ root: { live: { int: 0, frac: "a0" } } });
    expect(snapshot.pinnedRelationsByNodeId).toEqual({});
  });
});
