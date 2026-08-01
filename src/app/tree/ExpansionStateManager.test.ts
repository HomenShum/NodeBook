import { ExpansionStateManager } from "@/app/tree/ExpansionStateManager";

const authFetch = jest.fn();

jest.mock("@/app/util", () => ({
  getAuthFetch: () => authFetch,
}));

describe("ExpansionStateManager persistence boundaries", () => {
  beforeEach(() => authFetch.mockReset());

  test("an anonymous evaluator can expand and collapse a notebook without cloud API traffic", async () => {
    const manager = new ExpansionStateManager(false);

    expect(await manager.loadExpansionState("guest-root")).toBeNull();
    expect(await manager.saveExpansionState("guest-root", ["/all/relation-1"])).toBe(true);
    expect(await manager.clearExpansionState("guest-root")).toBe(true);
    expect(authFetch).not.toHaveBeenCalled();
  });

  test("a signed-in owner still loads expansion state through the authenticated boundary", async () => {
    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { expandedObjects: ["/all/relation-1"] } }),
    });
    const manager = new ExpansionStateManager(true);

    await expect(manager.loadExpansionState("owner-root")).resolves.toEqual(["/all/relation-1"]);
    expect(authFetch).toHaveBeenCalledWith("/api/expansion-state?rootObjectId=owner-root");
  });
});
