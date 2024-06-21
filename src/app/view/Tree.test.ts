import { DescendantTreeNode, RootTreeNode, getAncestorsAsArray } from "@/app/view/Tree";

describe("Tree", () => {
  describe("getAncestorsAsArray", () => {
    it("should return ancestors of a node ordered from most to least distant", () => {
      // TODO: This should really be a test of the Tree class, not a helper function
      const treeNode = {
        type: "descendant",
        object: { id: "o1" },
        relationWithParent: { id: "r1" },
        path: "/r4/r3/r2/r1",
        parent: {
          type: "descendant",
          object: { id: "o2" },
          relationWithParent: { id: "r2" },
          path: "/r4/r3/r2",
          parent: {
            type: "root",
            object: { id: "o3" },
            relationWithParent: { id: "r3" },
            path: "/r4/r3",
            parent: {
              type: "path",
              object: { id: "o4" },
              relationToChild: { id: "r3" },
              path: "/r4",
              parent: {
                type: "path",
                object: { id: "o5" },
                relationToChild: { id: "r4" },
                parent: null,
                path: "",
              },
            },
          },
        },
      } as DescendantTreeNode;
      expect(getAncestorsAsArray(treeNode)).toMatchObject([
        {
          object: { id: "o5" },
          relationToChild: { id: "r4" },
          path: "",
        },
        {
          object: { id: "o4" },
          relationToChild: { id: "r3" },
          path: "/r4",
        },
        {
          object: { id: "o3" },
          relationToChild: { id: "r2" },
          path: "/r4/r3",
        },
        {
          object: { id: "o2" },
          relationToChild: { id: "r1" },
          path: "/r4/r3/r2",
        },
      ]);
    });
    it("should handle no parent", () => {
      const treeNode = {
        type: "root",
        parent: null,
      } as RootTreeNode;
      expect(getAncestorsAsArray(treeNode).length).toBe(0);
    });
  });
});
