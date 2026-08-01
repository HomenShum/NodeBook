// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { MOCK_NODEBOOK_USER, UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import { UserContext } from "@/app/contexts/UserContext";

import { SlugProvider, useSlugs } from "./SlugContext";

const authFetch = jest.fn();

jest.mock("@/app/envFrontend", () => ({
  env: { isPersistenceEnabled: true },
}));

jest.mock("@/app/util", () => ({
  getAuthFetch: () => authFetch,
}));

describe("SlugProvider authenticated production scenarios", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    authFetch.mockReset();
  });

  test("a signed-in notebook owner can list, update, and delete shortlinks through the authenticated boundary", async () => {
    authFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [{ id: "node-1", slug: "launch-plan" }] }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    let context: ReturnType<typeof useSlugs> | undefined;
    function Harness() {
      const value = useSlugs();
      useEffect(() => {
        context = value;
      }, [value]);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <UserContext.Provider value={MOCK_NODEBOOK_USER}>
          <SlugProvider>
            <Harness />
          </SlugProvider>
        </UserContext.Provider>,
      );
    });

    await act(async () => context!.fetchAllSlugs());
    expect(context!.slugs).toEqual({ "node-1": "launch-plan" });

    await act(async () => {
      expect(await context!.updateSlugByNodeId("node-1", "launch-review")).toBe(true);
    });
    expect(context!.slugs).toEqual({ "node-1": "launch-review" });

    await act(async () => context!.deleteSlugByNodeId("node-1"));
    expect(context!.slugs).toEqual({});

    expect(authFetch).toHaveBeenNthCalledWith(1, "/api/slug");
    expect(authFetch).toHaveBeenNthCalledWith(
      2,
      "/api/slug",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ slug: "launch-review", nodeId: "node-1" }) }),
    );
    expect(authFetch).toHaveBeenNthCalledWith(
      3,
      "/api/slug",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ nodeId: "node-1" }) }),
    );

    await act(async () => root.unmount());
  });

  test("an anonymous evaluator can use local shortlinks without any authenticated API traffic", async () => {
    let context: ReturnType<typeof useSlugs> | undefined;
    function Harness() {
      const value = useSlugs();
      useEffect(() => {
        context = value;
      }, [value]);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <UserContext.Provider value={UNLOGGED_USER}>
          <SlugProvider>
            <Harness />
          </SlugProvider>
        </UserContext.Provider>,
      );
    });

    await act(async () => context!.fetchAllSlugs());
    await act(async () => {
      expect(await context!.updateSlugByNodeId("guest-node", "private-draft")).toBe(true);
    });
    expect(context!.slugs).toEqual({ "guest-node": "private-draft" });

    await act(async () => context!.deleteSlugByNodeId("guest-node"));
    expect(context!.slugs).toEqual({});
    expect(authFetch).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
