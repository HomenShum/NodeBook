import path from "path";

import { createTestTreeFromTemplate, expectTreeToMatchTemplate } from "@/app/tree/__test__/helpers";
import { updateGlobalLoggerFilter } from "@/lib/logger";
import { testAllExamplesInFileExecute } from "@/lib/testAllExamplesInFileExecute";

describe("Tree", () => {
  beforeAll(() => {
    updateGlobalLoggerFilter({ level: "info" });
  });
  describe("move node selection", () => {
    describe("should select same node as editor selection on", () => {
      ["up", "down"].forEach((direction) => {
        it(direction, async () => {
          const tree = await createTestTreeFromTemplate([{ rid: "1", isFocused: true }]);
          if (direction === "up") {
            tree.moveNodeSelectionHeadUp();
          } else {
            tree.moveNodeSelectionHeadDown();
          }
          expectTreeToMatchTemplate(tree, [{ rid: "1", isHead: true, isAnchor: true }]);
        });
      });
    });
    it("should move head up to sibling above", async () => {
      // prettier-ignore
      const tree = await createTestTreeFromTemplate([
        { rid: "1" }, 
        { rid: "2", isHead: true, isAnchor: true }
      ]);
      tree.moveNodeSelectionHeadUp();
      expectTreeToMatchTemplate(tree, [
        { rid: "1", isHead: true },
        { rid: "2", isAnchor: true },
      ]);
    });
    it("should move anchor up with head when anchor is descendant of head", async () => {
      // prettier-ignore
      const tree = await createTestTreeFromTemplate([
        { rid: "1", children: [
          { rid: "2", children: [
            { rid: "3", isHead: true, isAnchor: true },
          ]},
        ]}
      ]);
      tree.moveNodeSelectionHeadUp();
      // prettier-ignore
      expectTreeToMatchTemplate(tree, [
        { rid: "1", children: [
          { rid: "2", isHead: true, isAnchor: true, children: [
            { rid: "3" },
          ]},
        ]}
      ]);
    });
    it("should move head up to lowest descendant of sibling above", async () => {
      const tree = await createTestTreeFromTemplate([
        // prettier-ignore
        { rid: "1", children: [
          { rid: "2" }]},
        { rid: "3", isHead: true, isAnchor: true },
      ]);
      tree.moveNodeSelectionHeadUp();
      expectTreeToMatchTemplate(tree, [
        // prettier-ignore
        { rid: "1", children: [
          { rid: "2", isHead: true }]},
        { rid: "3", isAnchor: true },
      ]);
    });
  });
  describe("indentation", () => {
    it("should work on node range selection", async () => {
      const tree = await createTestTreeFromTemplate([
        // prettier-ignore
        { rid: "1" },
        { rid: "2", isHead: true },
        { rid: "3", isAnchor: true },
      ]);
      tree.indentSelection();
      expectTreeToMatchTemplate(tree, [
        // prettier-ignore
        { rid: "1", children: [
            { rid: "2", isHead: true },
            { rid: "3", isAnchor: true },
          ],
        },
      ]);
    });
    it("should indent entire subtree", async () => {
      // prettier-ignore
      const tree = await createTestTreeFromTemplate([
        { rid: "1" },
        { rid: "2", isHead: true, isAnchor: true, children: [
          { rid: "3" },
        ]},
      ]);
      tree.indentSelection();
      // prettier-ignore
      expectTreeToMatchTemplate(tree, [
        { rid: "1", children: [
          { rid: "2", isHead: true, isAnchor: true, children: [
            { rid: "3" },
          ]},
        ]},
      ]);
    });
  });
  describe("move nodes", () => {
    describe("should move focused node", () => {
      ["up", "down"].forEach((direction) => {
        it(direction, async () => {
          // prettier-ignore
          const tree = await createTestTreeFromTemplate([
            { rid: "1" }, 
            { rid: "2", isFocused: true },
            { rid: "3" },
          ]);
          if (direction === "up") {
            tree.moveSelectedNodesUp();
            // prettier-ignore
            expectTreeToMatchTemplate(tree, [
              { rid: "2", isFocused: true },
              { rid: "1" }, 
              { rid: "3" },
            ]);
          } else {
            tree.moveSelectedNodesDown();
            // prettier-ignore
            expectTreeToMatchTemplate(tree, [
              { rid: "1" }, 
              { rid: "3" },
              { rid: "2", isFocused: true },
            ]);
          }
        });
      });
    });
    it("should handle multiple selected nodes", async () => {
      // prettier-ignore
      const tree = await createTestTreeFromTemplate([
          { rid: "1" }, 
          { rid: "2" }, 
          { rid: "3", isHead: true, children: [
            { rid: "4" },
          ]},
          { rid: "5", isAnchor: true },
        ]);
      tree.moveSelectedNodesUp();
      // prettier-ignore
      expectTreeToMatchTemplate(tree, [
          { rid: "1" }, 
          { rid: "3", isHead: true, children: [
            { rid: "4" },
          ]},
          { rid: "5", isAnchor: true },
          { rid: "2" }, 
        ]);
    });
    it("should move to parents sibling if there's no sibling above", async () => {
      // prettier-ignore
      const tree = await createTestTreeFromTemplate([
          { rid: "1" }, 
          { rid: "2" }, 
          { rid: "3", children: [
            { rid: "4", isHead: true },
            { rid: "5", isAnchor: true },
            { rid: "6" },
          ]},
        ]);
      tree.moveSelectedNodesUp();
      // prettier-ignore
      expectTreeToMatchTemplate(tree, [
          { rid: "1" }, 
          { rid: "2", children: [
            { rid: "4", isHead: true },
            { rid: "5", isAnchor: true },
          ]},
          { rid: "3", children: [
            { rid: "6" },
          ]},
        ]);
    });
  });
  describe("helper examples should run", () => {
    testAllExamplesInFileExecute(path.resolve(__dirname, "helpers.ts"), { createTestTreeFromTemplate });
  });
});
