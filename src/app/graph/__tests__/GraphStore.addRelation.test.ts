import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.addRelation", () => {
  let graphStore: GraphStore;
  let startNode: GraphNode;
  let endNode: GraphNode;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();

    startNode = await graphStore.addNode({
      nodeProps: {
        id: "start",
      },
    });
    endNode = await graphStore.addNode({
      nodeProps: {
        id: "end",
      },
    });

    graphStore.updateManager.cleanup();
  });

  it("should create a new relation", async () => {
    const relation = await graphStore.addRelation({
      id: "relation",
      fromId: startNode.id,
      toId: endNode.id,
    });

    expect(relation).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(MIN_NUM_RELATIONS + 1);
    expect(relation.from).toBe(startNode);
    expect(relation.fromPosition).toBeDefined();
    expect(relation.to).toBe(endNode);
    expect(relation.toPosition).toBeDefined();
    expect(startNode.relations).toHaveLength(1);
    expect(startNode.relations).toEqual(expect.arrayContaining([relation]));
    expect(endNode.relations).toHaveLength(1);
    expect(endNode.relations).toEqual(expect.arrayContaining([relation]));
  });
  it("should queue GraphUpdates for creating a relation and updating relation lists", async () => {
    const relation = await graphStore.addRelation({
      id: "relation",
      fromId: startNode.id,
      toId: endNode.id,
    });

    // Get pendingUpdates without the transactionId for comparison
    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        {
          operation: "addRelation",
          relation: relation.serialize(),
          fromPos: relation.fromPosition,
          toPos: relation.toPosition,
        },
        {
          operation: "updateRelationList",
          nodeId: startNode.id,
          authorId: startNode.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.fromPosition,
        },
        {
          operation: "updateRelationList",
          nodeId: endNode.id,
          authorId: endNode.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.toPosition,
        },
      ],
    ]);
  });
  it("should create a working revert operation", async () => {
    const relation = await graphStore.addRelation({
      id: "relation",
      fromId: startNode.id,
      toId: endNode.id,
    });

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getRelation(relation.id)).toBeUndefined();
    expect(graphStore.relationsById.size).toBe(MIN_NUM_RELATIONS);
    expect(startNode.relations).toHaveLength(0);
    expect(endNode.relations).toHaveLength(0);
  });
});
