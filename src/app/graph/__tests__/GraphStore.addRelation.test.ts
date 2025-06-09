import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { SettingsStore } from "@/app/graph/SettingsStore";

import { MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.addRelation", () => {
  let graphStore: GraphStore;
  let startNode: GraphNode;
  let endNode: GraphNode;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });
    const user = MOCK_MEW_USER;
    user.settings.publicMode = false;
    graphStore = new GraphStore(user, new SettingsStore(user));

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
          type: "all",
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.fromPosition,
          oldIsPublic: false,
          newIsPublic: false,
        },
        {
          operation: "updateNode",
          oldProps: { ...startNode.serialize(), canonicalRelationId: null },
          newProps: { ...startNode.serialize(), canonicalRelationId: relation.id },
        },
        {
          operation: "updateRelationList",
          nodeId: endNode.id,
          authorId: endNode.authorId,
          type: "all",
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.toPosition,
          oldIsPublic: false,
          newIsPublic: false,
        },
        {
          operation: "updateNode",
          oldProps: { ...endNode.serialize(), canonicalRelationId: null },
          newProps: { ...endNode.serialize(), canonicalRelationId: relation.id },
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
  it("a node should become public if it is being related to another node which has `isPublic` and `isNewRelatedObjectsPublic` set", async () => {
    await graphStore.setIsPublic({
      objectId: startNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: true,
      isChecked: null,
    });

    await graphStore.setIsPublic({
      objectId: endNode.id,
      isPublic: false,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: false,
      isChecked: null,
    });

    const relation = await graphStore.addRelation({
      id: "relation",
      fromId: startNode.id,
      toId: endNode.id,
    });

    expect(graphStore.getRelation(relation.id)).toBeDefined();
    expect(relation.isPublic).toBeTruthy();
    expect(startNode.isPublic).toBeTruthy();
    expect(startNode.isNewRelatedObjectsPublic).toBeTruthy();
    expect(endNode.isPublic).toBeTruthy();
    expect(endNode.isNewRelatedObjectsPublic).toBeTruthy();
  });
  it("relation list item should be public if relation is public", async () => {
    await graphStore.settings?.setPublicMode(true);

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
          type: "all",
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.fromPosition,
          oldIsPublic: false,
          newIsPublic: true,
        },
        {
          operation: "updateNode",
          oldProps: { ...startNode.serialize(), canonicalRelationId: null },
          newProps: { ...startNode.serialize(), canonicalRelationId: relation.id },
        },
        {
          operation: "updateRelationList",
          nodeId: endNode.id,
          authorId: endNode.authorId,
          type: "all",
          relationId: relation.id,
          oldPosition: null,
          newPosition: relation.toPosition,
          oldIsPublic: false,
          newIsPublic: true,
        },
        {
          operation: "updateNode",
          oldProps: { ...endNode.serialize(), canonicalRelationId: null },
          newProps: { ...endNode.serialize(), canonicalRelationId: relation.id },
        },
      ],
    ]);

    expect(graphStore.getRelation(relation.id)).toBeDefined();
  });
});
