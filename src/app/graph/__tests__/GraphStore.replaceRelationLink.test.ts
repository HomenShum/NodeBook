import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_NODES } from "./helpers";

describe("GraphStore.replaceRelationLink", () => {
  let graphStore: GraphStore;

  let nodeA: GraphNode;
  let nodeB: GraphNode;
  let nodeC: GraphNode;
  let relationAB: GraphRelation;
  let relationBC: GraphRelation;
  let relationAC: GraphRelation;

  const NUM_NODES_START = MIN_NUM_NODES + 3;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();

    nodeA = await graphStore.addNode({ nodeProps: { id: "a" } });
    nodeB = await graphStore.addNode({ nodeProps: { id: "b" } });
    nodeC = await graphStore.addNode({ nodeProps: { id: "c" } });
    relationAB = await graphStore.addRelation({ id: "ab", fromId: nodeA.id, toId: nodeB.id });
    relationBC = await graphStore.addRelation({ id: "bc", fromId: nodeB.id, toId: nodeC.id });
    relationAC = await graphStore.addRelation({ id: "ac", fromId: nodeA.id, toId: nodeC.id });

    graphStore.updateManager.cleanup();
  });

  it("should be able to replace the from or to of a relation with an existing node", async () => {
    expect(relationAB.from).toBe(nodeA);
    expect(nodeA.relations).toHaveLength(2);
    expect(nodeA.relations).toEqual(expect.arrayContaining([relationAB]));
    expect(nodeC.relations).toHaveLength(2);
    expect(nodeC.relations).not.toEqual(expect.arrayContaining([relationAB]));

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "existing-object", id: nodeC.id },
    });

    expect(relationAB.from).toBe(nodeC);
    expect(nodeA.relations).toHaveLength(1);
    expect(nodeA.relations).not.toEqual(expect.arrayContaining([relationAB]));
    expect(nodeC.relations).toHaveLength(3);
    expect(nodeC.relations).toEqual(expect.arrayContaining([relationAB]));

    expect(relationBC.to).toBe(nodeC);
    expect(nodeA.relations).not.toEqual(expect.arrayContaining([relationBC]));

    await graphStore.replaceRelationLink({
      relationId: relationBC.id,
      direction: "to",
      replaceWith: { type: "existing-object", id: nodeA.id },
    });

    expect(relationBC.to).toBe(nodeA);
    expect(nodeA.relations).toHaveLength(2);
    expect(nodeA.relations).toEqual(expect.arrayContaining([relationBC]));
    expect(nodeC.relations).toHaveLength(2);
    expect(nodeC.relations).not.toEqual(expect.arrayContaining([relationBC]));
  });
  it("should queue correct GraphUpdates when replacing a relation link with an existing node", async () => {
    const abAtStart = relationAB.serialize();
    const abPosition = graphStore.getRelationList(nodeA).get(relationAB.id)?.position;

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "existing-object", id: nodeC.id },
    });

    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        {
          operation: "updateRelation",
          oldProps: abAtStart,
          newProps: relationAB.serialize(),
        },
        {
          operation: "updateRelationList",
          nodeId: nodeA.id,
          authorId: nodeA.authorId,
          pinned: false,
          relationId: relationAB.id,
          oldPosition: abPosition,
          newPosition: null,
        },
        {
          operation: "updateRelationList",
          nodeId: nodeC.id,
          authorId: nodeC.authorId,
          pinned: false,
          relationId: relationAB.id,
          oldPosition: null,
          newPosition: abPosition,
        },
      ],
    ]);
  });
  it("should create a working revert operation", async () => {
    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "existing-object", id: nodeC.id },
    });

    graphStore.updateManager.revertAllPending();

    expect(relationAB.from).toBe(nodeA);
    expect(nodeA.relations).toHaveLength(2);
    expect(nodeA.relations).toEqual(expect.arrayContaining([relationAB]));
    expect(nodeC.relations).toHaveLength(2);
    expect(nodeC.relations).not.toEqual(expect.arrayContaining([relationAB]));
  });
  it("should be able to replace the from or to of a relation with a new node", async () => {
    expect(nodeA.relations).toHaveLength(2);

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "new-node" },
    });

    expect(nodeA.relations).toHaveLength(1);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);

    await graphStore.replaceRelationLink({
      relationId: relationBC.id,
      direction: "to",
      replaceWith: { type: "new-node" },
    });

    expect(nodeC.relations).toHaveLength(1);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 2);
  });
  it("should queue two GraphUpdates for replacing a relation link with a new node", async () => {
    const abAtStart = relationAB.serialize();
    const abPosition = graphStore.getRelationList(nodeA).get(relationAB.id)?.position;

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "new-node" },
    });

    const newNode = relationAB.from;
    expect(newNode).toBeDefined();
    expect(newNode).not.toBe(nodeA);
    expect(newNode instanceof GraphNode).toBe(true);

    const serializedNewNode = (newNode as GraphNode).serialize();

    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        { operation: "addNode", node: serializedNewNode },
        {
          operation: "updateRelation",
          oldProps: abAtStart,
          newProps: relationAB.serialize(),
        },
        {
          operation: "updateRelationList",
          nodeId: nodeA.id,
          authorId: nodeA.authorId,
          pinned: false,
          relationId: relationAB.id,
          oldPosition: abPosition,
          newPosition: null,
        },
        {
          operation: "updateRelationList",
          nodeId: newNode.id,
          authorId: newNode.authorId,
          pinned: false,
          relationId: relationAB.id,
          oldPosition: null,
          newPosition: abPosition,
        },
      ],
    ]);
  });
  it("should create an revert operation that cleans up created nodes", async () => {
    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "from",
      replaceWith: { type: "new-node" },
    });

    const newNode = relationAB.from;
    expect(newNode).toBeDefined();
    expect(newNode).not.toBe(nodeA);
    expect(graphStore.getNode(newNode.id)).toBe(newNode);

    graphStore.updateManager.revertAllPending();

    expect(relationAB.from).toBe(nodeA);
    expect(nodeA.relations).toHaveLength(2);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.getNode(newNode.id)).toBeUndefined();
  });
  it("should delete nodes that it orphans when replacing a relation link", async () => {
    expect(nodeB.relations).toHaveLength(2);

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "to",
      replaceWith: { type: "existing-object", id: nodeC.id },
    });

    expect(nodeB.relations).toHaveLength(1);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.getNode(nodeB.id)).toBe(nodeB);

    await graphStore.replaceRelationLink({
      relationId: relationBC.id,
      direction: "from",
      replaceWith: { type: "existing-object", id: nodeA.id },
    });

    expect(nodeB.relations).toHaveLength(0);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START - 1);
    expect(graphStore.getNode(nodeB.id)).toBeUndefined();
  });
  it("should create an revert operation that can restore orphaned nodes", async () => {
    const nodeBAtStart = nodeB.serialize();

    await graphStore.replaceRelationLink({
      relationId: relationAB.id,
      direction: "to",
      replaceWith: { type: "existing-object", id: nodeC.id },
    });
    await graphStore.replaceRelationLink({
      relationId: relationBC.id,
      direction: "from",
      replaceWith: { type: "existing-object", id: nodeA.id },
    });

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getNode(nodeB.id)?.relations).toHaveLength(2);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.getNode(nodeB.id)?.serialize()).toEqual(nodeBAtStart);
  });
});
