import path from "path";

import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { createTestTreeFromTemplate, expectTreeToMatchTemplate } from "@/app/tree/__test__/helpers";
import { Tree } from "@/app/tree/Tree";
import appLogger from "@/lib/logger";
import { testAllExamplesInFileExecute } from "@/lib/testAllExamplesInFileExecute";

describe("Tree", () => {
  beforeAll(() => {
    appLogger.setGlobalConsoleFilter({ level: "info" });
  });
  describe("computing state from graph", () => {
    it("basic", async () => {
      const settingsStore = new SettingsStore();
      const graphStore = new GraphStore(MOCK_MEW_USER);
      const root = graphStore.userRoot;
      // Add 2 children of the root, each with a child of their own
      const { node: n1, relation: r1 } = await graphStore.addChildNode({
        parentId: root.id,
        nodeProps: { content: "1" },
      });
      const { relation: r2 } = await graphStore.addChildNode({
        parentId: n1.id,
        nodeProps: { content: "2" },
      });
      const { node: n3, relation: r3 } = await graphStore.addChildNode({
        parentId: graphStore.userRoot.id,
        nodeProps: { content: "3" },
        after: r1,
      });
      await graphStore.addChildNode({
        parentId: n3.id,
        nodeProps: { content: "4" },
      });
      // Create a tree starting from the root, but only with the first child expanded
      const tree = new Tree(graphStore, settingsStore, graphStore.userRoot, {
        expansions: new Map<string, boolean>([[`/all/${r1.id}`, true]]),
      });
      // prettier-ignore
      expectTreeToMatchTemplate(tree, [
        { rid: r1.id, children: [ // this is expanded, so it's children should be shown
          { rid: r2.id }] },
        { rid: r3.id}, // this isn't expanded, so they shouldn't be shown
      ]);
    });
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
    describe("anchor should become last head when moving up", () => {
      it("for single child", async () => {
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
              { rid: "2", isHead: true, children: [
                  { rid: "3", isAnchor: true },
                ]},
            ]}
        ]);
        tree.moveNodeSelectionHeadUp();
        expectTreeToMatchTemplate(tree, [
          { rid: "1", isHead: true, children: [{ rid: "2", isAnchor: true, children: [{ rid: "3" }] }] },
        ]);
      });
      it("for multiple children", async () => {
        // prettier-ignore
        const tree = await createTestTreeFromTemplate([
          { rid: "1", children: [
              { rid: "2", children: [
                  { rid: "3" },
                  { rid: "4", isHead: true, isAnchor: true },
                ]},
            ]}
        ]);
        tree.moveNodeSelectionHeadUp();
        tree.moveNodeSelectionHeadUp();
        // prettier-ignore
        expectTreeToMatchTemplate(tree, [
          { rid: "1", children: [
              { rid: "2", isHead: true, children: [
                  { rid: "3", isAnchor: true },
                  { rid: "4" },
                ]},
            ]}
        ]);
        tree.moveNodeSelectionHeadUp();
        expectTreeToMatchTemplate(tree, [
          { rid: "1", isHead: true, children: [{ rid: "2", isAnchor: true, children: [{ rid: "3" }, { rid: "4" }] }] },
        ]);
      });
    });
    it("should move head up to lowest descendant of sibling above only if it was anchor", async () => {
      let tree = await createTestTreeFromTemplate([
        // prettier-ignore
        { rid: "1", children: [
          { rid: "2", isAnchor: true }]},
        { rid: "3", isHead: true },
      ]);
      tree.moveNodeSelectionHeadUp();
      expectTreeToMatchTemplate(tree, [
        // prettier-ignore
        { rid: "1", children: [
          { rid: "2", isAnchor: true, isHead: true }]},
        { rid: "3" },
      ]);
      tree = await createTestTreeFromTemplate([
        // prettier-ignore
        { rid: "1", children: [
            { rid: "2" }]},
        { rid: "3", isAnchor: true, isHead: true },
      ]);
      tree.moveNodeSelectionHeadUp();
      expectTreeToMatchTemplate(tree, [
        // prettier-ignore
        { rid: "1", isHead: true, children: [
            { rid: "2" }]},
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
      await tree.indentSelection();
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
      await tree.indentSelection();
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
            await tree.moveSelectedNodesUp();
            // prettier-ignore
            expectTreeToMatchTemplate(tree, [
              { rid: "2", isFocused: true },
              { rid: "1" },
              { rid: "3" },
            ]);
          } else {
            await tree.moveSelectedNodesDown();
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
    it("should be able to move subtree with multiple children", async () => {
      const tree = await createTestTreeFromTemplate([
        { rid: "1" },
        { rid: "2" },
        { rid: "3", children: [{ rid: "4" }, { rid: "5", isAnchor: true, isHead: true }] },
        { rid: "6" },
      ]);
      tree.moveNodeSelectionHeadUp();
      tree.moveNodeSelectionHeadUp();
      expectTreeToMatchTemplate(tree, [
        { rid: "1" },
        { rid: "2" },
        { rid: "3", isHead: true, children: [{ rid: "4", isAnchor: true }, { rid: "5" }] },
        { rid: "6" },
      ]);
      await tree.moveSelectedNodesUp();
      await tree.moveSelectedNodesUp();
      expectTreeToMatchTemplate(tree, [
        { rid: "3", isHead: true, children: [{ rid: "4", isAnchor: true }, { rid: "5" }] },
        { rid: "1" },
        { rid: "2" },
        { rid: "6" },
      ]);
      await tree.moveSelectedNodesDown();
      expectTreeToMatchTemplate(tree, [
        { rid: "1" },
        { rid: "3", isHead: true, children: [{ rid: "4", isAnchor: true }, { rid: "5" }] },
        { rid: "2" },
        { rid: "6" },
      ]);
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
      await tree.moveSelectedNodesUp();
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
      await tree.moveSelectedNodesUp();
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
