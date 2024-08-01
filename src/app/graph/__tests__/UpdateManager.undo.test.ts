import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("UpdateManaager.undo", () => {
  let graphStore: GraphStore;

  let node: GraphNode;

  const NUM_NODES_START = MIN_NUM_NODES + 1;
  const NUM_RELATIONS_START = MIN_NUM_RELATIONS;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();
    node = await graphStore.addNode({
      nodeProps: {
        id: "a",
        version: 1,
        content: "start content",
      },
    });
    graphStore.updateManager.clear();
  });

  it("can undo and redo a simple node update", async () => {
    expect(node.version).toBe(1);
    expect(node.content).toEqual([{ type: "text", value: "start content" }]);

    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content" },
    });

    expect(node.version).toBe(2);
    expect(node.content).toEqual([{ type: "text", value: "new content" }]);

    graphStore.updateManager.undo();

    expect(node.version).toBe(1);
    expect(node.content).toEqual([{ type: "text", value: "start content" }]);

    graphStore.updateManager.redo();

    expect(node.version).toBe(2);
    expect(node.content).toEqual([{ type: "text", value: "new content" }]);
  });

  it("creates new sync updates when undoing and redoing", async () => {
    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content" },
    });

    expect(graphStore.updateManager.pendingUpdates.length).toBe(1);

    graphStore.updateManager.undo();

    expect(graphStore.updateManager.pendingUpdates.length).toBe(2);

    graphStore.updateManager.redo();

    expect(graphStore.updateManager.pendingUpdates.length).toBe(3);

    // The second undo() call here should be a no-op since there's only been one action
    graphStore.updateManager.undo();
    graphStore.updateManager.undo();

    expect(graphStore.updateManager.pendingUpdates.length).toBe(4);
  });

  it("can undo and redo a change that affects multiple GraphObjects", async () => {
    expect(node.relations).toHaveLength(0);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);

    let { node: child, relation } = await graphStore.addChildNode({
      parentId: node.id,
      nodeProps: { content: "child content" },
    });

    expect(node.relations).toEqual(expect.arrayContaining([relation]));
    expect(child.relations).toEqual(expect.arrayContaining([relation]));
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);

    graphStore.updateManager.undo();

    expect(node.relations).toHaveLength(0);
    expect(child.relations).toHaveLength(0);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);

    graphStore.updateManager.redo();

    expect(graphStore.getNode(child.id)).toBeDefined();
    child = graphStore.getNode(child.id)!;
    expect(graphStore.getRelation(relation.id)).toBeDefined();
    relation = graphStore.getRelation(relation.id)!;

    expect(node.relations).toEqual(expect.arrayContaining([relation]));
    expect(child.relations).toEqual(expect.arrayContaining([relation]));
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);
  });

  it("can correctly undo and redo multiple actions", async () => {
    let numSyncTasks = 0;

    expect(node.relations).toHaveLength(0);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);

    let { node: child, relation } = await graphStore.addChildNode({
      parentId: node.id,
      nodeProps: {
        id: "child",
        content: "child content",
      },
      relationProps: {
        id: "relation",
      },
    });
    numSyncTasks += 1;

    expect(node.relations).toEqual(expect.arrayContaining([relation]));
    expect(child.relations).toEqual(expect.arrayContaining([relation]));
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);
    expect(child.version).toBe(1);
    expect(child.content).toEqual([{ type: "text", value: "child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    await graphStore.updateNode({
      nodeId: child.id,
      nodeProps: { content: "new child content" },
    });
    numSyncTasks += 1;

    expect(child.version).toBe(2);
    expect(child.content).toEqual([{ type: "text", value: "new child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    graphStore.updateManager.undo();
    numSyncTasks += 1;

    expect(child.version).toBe(1);
    expect(child.content).toEqual([{ type: "text", value: "child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    graphStore.updateManager.redo();
    numSyncTasks += 1;

    expect(child.version).toBe(2);
    expect(child.content).toEqual([{ type: "text", value: "new child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    // First undo reverts the node update
    graphStore.updateManager.undo();
    numSyncTasks += 1;
    // Second undo to revert the addChildNode action
    graphStore.updateManager.undo();
    numSyncTasks += 1;

    expect(node.relations).toHaveLength(0);
    expect(graphStore.getNode(child.id)).toBeUndefined();
    expect(graphStore.getRelation(relation.id)).toBeUndefined();
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    // First redo to redo the addChildNode action
    graphStore.updateManager.redo();
    numSyncTasks += 1;

    expect(graphStore.getNode(child.id)).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBeDefined();
    child = graphStore.getNode(child.id)!;
    relation = graphStore.getRelation(relation.id)!;

    expect(node.relations).toEqual(expect.arrayContaining([relation]));
    expect(child.relations).toEqual(expect.arrayContaining([relation]));
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);
    expect(child.version).toBe(1);
    expect(child.content).toEqual([{ type: "text", value: "child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    // Second redo to redo the updateNode action
    graphStore.updateManager.redo();
    numSyncTasks += 1;

    expect(child.version).toBe(2);
    expect(child.content).toEqual([{ type: "text", value: "new child content" }]);
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);
  });

  it("can correctly undo and redo a combined transaction", async () => {
    let numSyncTasks = 0;

    let { node: child, relation } = await graphStore.addChildNode({
      parentId: node.id,
      nodeProps: {
        id: "child",
        content: "child content",
      },
      relationProps: {
        id: "relation",
      },
    });
    numSyncTasks += 1;

    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);
    expect(node.version).toBe(1);
    expect(node.content).toEqual([{ type: "text", value: "start content" }]);
    expect(graphStore.getNode(child.id)).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBeDefined();
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    // This combined transaction based on what we do in the BackspaceMergeNodesPlugin
    await graphStore.applyCombinedTransaction([
      {
        type: "updateNode",
        transaction: {
          nodeId: node.id,
          nodeProps: { content: node.content.concat(child.content) },
        },
      },
      { type: "removeNode", transaction: { nodeId: child.id } },
    ]);
    numSyncTasks += 1;

    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(node.version).toBe(2);
    expect(node.content).toEqual([
      { type: "text", value: "start content" },
      { type: "text", value: "child content" },
    ]);
    expect(graphStore.getNode(child.id)).toBeUndefined();
    expect(graphStore.getRelation(relation.id)).toBeUndefined();
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    graphStore.updateManager.undo();
    numSyncTasks += 1;

    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);
    expect(node.version).toBe(1);
    expect(node.content).toEqual([{ type: "text", value: "start content" }]);
    expect(graphStore.getNode(child.id)).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBeDefined();
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);

    graphStore.updateManager.redo();
    numSyncTasks += 1;

    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(node.version).toBe(2);
    expect(node.content).toEqual([
      { type: "text", value: "start content" },
      { type: "text", value: "child content" },
    ]);
    expect(graphStore.getNode(child.id)).toBeUndefined();
    expect(graphStore.getRelation(relation.id)).toBeUndefined();
    expect(graphStore.updateManager.pendingUpdates.length).toBe(numSyncTasks);
  });
});
