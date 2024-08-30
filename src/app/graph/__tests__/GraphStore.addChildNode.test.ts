import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.addChildNode", () => {
  let graphStore: GraphStore;

  let parent: GraphNode;

  const NUM_NODES_START = MIN_NUM_NODES + 1;
  const NUM_RELATIONS_START = MIN_NUM_RELATIONS;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();

    parent = await graphStore.addNode({});

    graphStore.updateManager.cleanup();
  });

  it("should create a new node", async () => {
    const { node } = await graphStore.addChildNode({ parentId: parent.id });

    expect(node).toBeDefined();
    expect(graphStore.getNode(node.id)).toBe(node);
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START + 1);
  });
  it("should create a new node with the correct parent", async () => {
    expect(parent.relations).toHaveLength(0);

    const { node: child, relation } = await graphStore.addChildNode({ parentId: parent.id });

    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START + 1);

    expect(relation.from).toBe(parent);
    expect(parent.relations).toHaveLength(1);
    expect(parent.relations).toEqual(expect.arrayContaining([relation]));

    const parentRelations = child.relations.filter((r) => r.relationType.id === "child" && r.to.id === child.id);
    expect(parentRelations).toEqual(expect.arrayContaining([relation]));
  });
  it("should queue GraphUpdates for creating a node and relation", async () => {
    const { node: child, relation } = await graphStore.addChildNode({ parentId: parent.id });

    // Get pendingUpdates without the transactionId for comparison
    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        { operation: "addNode", node: child.serialize() },
        {
          operation: "addRelation",
          relation: relation.serialize(),
          fromPos: relation.fromPosition,
          toPos: relation.toPosition,
        },
        {
          operation: "updateRelationList",
          nodeId: parent.id,
          authorId: parent.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: null,
          newPosition: graphStore.getRelationList(parent).get(relation.id)?.position,
        },
        {
          operation: "updateRelationList",
          nodeId: child.id,
          authorId: child.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: null,
          newPosition: graphStore.getRelationList(child).get(relation.id)?.position,
        },
      ],
    ]);
  });
  it("should create a working revert operation", async () => {
    const { node, relation } = await graphStore.addChildNode({ parentId: graphStore.outlineRoot.id });

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getNode(node.id)).toBeUndefined();
    expect(graphStore.nodesById.size).toBe(NUM_NODES_START);
    expect(graphStore.getRelation(relation.id)).toBeUndefined();
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(graphStore.outlineRoot.relations).toHaveLength(1);
    expect(graphStore.outlineRoot.relations).toEqual([graphStore.outlineRootRelationFromUserRoot]);
  });
});
