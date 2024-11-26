import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_NODES_WITH_USER, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.removeNode", () => {
  let graphStore: GraphStore;

  let orphanNode: GraphNode;
  let nodeA: GraphNode;
  let nodeB: GraphNode;
  let nodeC: GraphNode;
  let relationAB: GraphRelation;
  let relationBC: GraphRelation;

  const NUM_NODES_START = MIN_NUM_NODES_WITH_USER + 4;
  const NUM_RELATIONS_START = MIN_NUM_RELATIONS + 2;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(MOCK_MEW_USER);

    orphanNode = await graphStore.addNode({});
    nodeA = await graphStore.addNode({ nodeProps: { id: "a" } });
    nodeB = await graphStore.addNode({ nodeProps: { id: "b" } });
    nodeC = await graphStore.addNode({ nodeProps: { id: "c" } });
    relationAB = await graphStore.addRelation({ id: "ab", fromId: nodeA.id, toId: nodeB.id });
    relationBC = await graphStore.addRelation({ id: "bc", fromId: nodeB.id, toId: nodeC.id });

    graphStore.updateManager.cleanup();
  });

  it("should delete a specified node", async () => {
    expect(orphanNode).toBeDefined();
    expect(graphStore.getNode(orphanNode.id)).toBe(orphanNode);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);

    await graphStore.removeNode({ nodeId: orphanNode.id });

    expect(graphStore.getNode(orphanNode.id)).toBeUndefined();
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START - 1);
  });
  it("should queue a GraphUpdate for deleting the specified node", async () => {
    await graphStore.removeNode({ nodeId: orphanNode.id });

    // Get pendingUpdates without the transactionId for comparison
    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([[{ operation: "deleteNode", node: orphanNode.serialize() }]]);
  });
  it("should create a working revert operation", async () => {
    await graphStore.removeNode({ nodeId: nodeA.id });

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getNode(nodeA.id)?.serialize()).toEqual(nodeA.serialize());
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
  });
  it("should delete all relations of the specified node", async () => {
    expect(nodeA.relations).toHaveLength(1);
    expect(nodeA.relations).toEqual(expect.arrayContaining([relationAB]));
    expect(graphStore.getRelation(relationAB.id)).toBe(relationAB);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);

    await graphStore.removeNode({ nodeId: nodeA.id });

    expect(graphStore.getRelation(relationAB.id)).toBeUndefined();
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 1);
  });
  it("should be able to revert deletion of a node with relations", async () => {
    await graphStore.removeNode({ nodeId: nodeA.id });

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getNode(nodeA.id)?.serialize()).toEqual(nodeA.serialize());
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.getRelation(relationAB.id)?.serialize()).toEqual(relationAB.serialize());
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
  });
});
