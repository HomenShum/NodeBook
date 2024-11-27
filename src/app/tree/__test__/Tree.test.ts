import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { createTestTreeFromTemplate, expectTreeToMatchTemplate, getNewNoteTxs } from "@/app/tree/__test__/helpers";
import { Tree } from "@/app/tree/Tree";
import appLogger from "@/lib/logger";

// Note: If writing tests for selection in future,
// make sure for the initial state, the anchor and head belong
// to same node since we use a stack to undo the head move.
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
      const tree = new Tree(graphStore, settingsStore, graphStore.userRoot);
      tree.setPathExpanded(`${tree.root.id}/all/${r1.id}`, true);
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
    describe("anchor should not change when moving up", () => {
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
          { rid: "1", isHead: true, children: [{ rid: "2", children: [{ rid: "3", isAnchor: true }] }] },
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
                  { rid: "3" },
                  { rid: "4", isAnchor: true },
                ]},
            ]}
        ]);
        tree.moveNodeSelectionHeadUp();
        expectTreeToMatchTemplate(tree, [
          { rid: "1", isHead: true, children: [{ rid: "2", children: [{ rid: "3" }, { rid: "4", isAnchor: true }] }] },
        ]);
      });
    });
    it("should move head up to lowest descendant of sibling above only if it was anchor", async () => {
      let tree = await createTestTreeFromTemplate([
        // prettier-ignore
        { rid: "1", children: [
          { rid: "2", isAnchor: true, isHead: true }]},
        { rid: "3" },
      ]);
      tree.moveNodeSelectionHeadDown();
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
        { rid: "3", isHead: true, children: [{ rid: "4" }, { rid: "5", isAnchor: true }] },
        { rid: "6" },
      ]);
      await tree.moveSelectedNodesUp();
      await tree.moveSelectedNodesUp();
      expectTreeToMatchTemplate(tree, [
        { rid: "3", isHead: true, children: [{ rid: "4" }, { rid: "5", isAnchor: true }] },
        { rid: "1" },
        { rid: "2" },
        { rid: "6" },
      ]);
      await tree.moveSelectedNodesDown();
      expectTreeToMatchTemplate(tree, [
        { rid: "1" },
        { rid: "3", isHead: true, children: [{ rid: "4" }, { rid: "5", isAnchor: true }] },
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
    describe("should not lose focus", () => {
      it("when moving a subtree while anchor is a child of head", async () => {
        //Source: https://github.com/IdeaFlowCo/mew/pull/519#pullrequestreview-2360873800
        const tree = await createTestTreeFromTemplate([
          { rid: "1" },
          {
            rid: "2",
            children: [
              {
                rid: "3",
                children: [{ rid: "4", isAnchor: true, isHead: true }],
              },
            ],
          },
          { rid: "5" },
        ]);
        tree.moveNodeSelectionHeadUp();
        await tree.moveSelectedNodesUp();
        expectTreeToMatchTemplate(tree, [
          {
            rid: "1",
            children: [
              {
                rid: "3",
                isHead: true,
                children: [{ rid: "4", isAnchor: true }],
              },
            ],
          },
          {
            rid: "2",
          },
          { rid: "5" },
        ]);
      });
    });
    describe("splitting a multiline note", () => {
      it("in a basic case", async () => {
        const graphStore = new GraphStore(MOCK_MEW_USER);
        const root = graphStore.userRoot;

        const { node: n1, relation: r1 } = await graphStore.addChildNode({
          parentId: root.id,
          nodeProps: { content: "" },
          relationProps: { id: "original" },
        });

        const tree = new Tree(graphStore, new SettingsStore(), root);
        const treeNode = tree.getNodeOrThrow(tree.root.createChildPath(r1));

        const txs: TxCombined = getNewNoteTxs(tree, treeNode);

        graphStore.applyCombinedTransaction(txs);
        const secondRelation = graphStore.getRelation("second");
        if (secondRelation) {
          const path = treeNode.childrenGroupsById.noteContent.createChildPath(secondRelation);
          tree.setFocusedNode(path);
        }

        const splitOn = tree.getNodeOrThrow(`${tree.root.id}/all/original/noteContent/first`);
        await tree.splitNote(splitOn, { before: [], after: [] }, false, "split");

        expectTreeToMatchTemplate(tree, {
          children: [
            { rid: "original", children: [{ rid: "first" }] },
            { rid: "split", children: [{ rid: "second", isFocused: true }] },
          ],
        });
      });
      it("when there are cyclic relations", async () => {
        const graphStore = new GraphStore(MOCK_MEW_USER);
        const root = graphStore.userRoot;

        // Make original node
        const { node: n1, relation: r1 } = await graphStore.addChildNode({
          parentId: root.id,
          nodeProps: { content: "" },
          relationProps: { id: "original" },
        });

        const tree = new Tree(graphStore, new SettingsStore(), root);
        const treeRootId = tree.root.id;
        const treeNode = tree.getNodeOrThrow(tree.root.createChildPath(r1));

        // Get txs to convert to note
        const txs: TxCombined = getNewNoteTxs(tree, treeNode);

        // Apply txs
        graphStore.applyCombinedTransaction(txs);
        const secondRelation = graphStore.getRelation("second");
        if (secondRelation) {
          const path = treeNode.childrenGroupsById.noteContent.createChildPath(secondRelation);
          tree.setFocusedNode(path);
        }

        // define cycle parent
        const cycleParent = tree.getNodeOrThrow(`${treeRootId}/all/original/noteContent/second`);

        const thirdRel = "third";

        // create a cycle from a new child "third" to "second"
        const cycleTxs: TxCombined = [
          {
            type: "addChildNode",
            transaction: {
              parentId: cycleParent.object.id,
              nodeProps: { content: "", id: thirdRel },
              relationProps: { id: thirdRel },
            },
          },
          {
            type: "addRelationToList",
            transaction: {
              objectId: cycleParent.object.id,
              relationId: [thirdRel],
              listType: "noteContent",
            },
          },
          {
            type: "addRelation",
            transaction: {
              toId: "second",
              fromId: thirdRel,
              id: "cycle",
            },
          },
          {
            type: "addRelationToList",
            transaction: {
              objectId: cycleParent.object.id,
              relationId: ["cycle"],
              listType: "noteContent",
            },
          },
        ];
        graphStore.applyCombinedTransaction(cycleTxs);

        tree.setPathExpanded(`${treeRootId}/all/split/noteContent/second/noteContent/third/all/cycle`, false);

        const splitOn = tree.getNodeOrThrow(`${treeRootId}/all/original/noteContent/first`);

        await tree.splitNote(splitOn, { before: [], after: [] }, false, "split");

        expectTreeToMatchTemplate(tree, {
          children: [
            { rid: "original", children: [{ rid: "first" }] },
            {
              rid: "split",
              children: [{ rid: "second", children: [{ rid: "third" }], isFocused: true }],
            },
          ],
        });
      });
    });
  });
});
