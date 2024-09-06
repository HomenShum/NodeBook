import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { defaultRelationTypes, GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.updateRelation", () => {
  let graphStore: GraphStore;

  let startNode: GraphNode;
  let endNode: GraphNode;
  let relation: GraphRelation;

  const NUM_RELATIONS_START = MIN_NUM_RELATIONS + 1;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();

    startNode = await graphStore.addNode({
      nodeProps: {
        id: "start-node",
      },
    });
    endNode = await graphStore.addNode({
      nodeProps: {
        id: "end-node",
      },
    });
    relation = await graphStore.addRelation({
      id: "test-relation",
      fromId: startNode.id,
      toId: endNode.id,
    });

    graphStore.updateManager.cleanup();
  });

  it("should be able to update isPublic and increment version properly", async () => {
    expect(relation).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(relation.isPublic).toBe(false);
    expect(relation.version).toBe(1);
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(relation.from.allRelationsList.has(relation.id)).toBe(true);
    expect(relation.to.allRelationsList.has(relation.id)).toBe(true);

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: { isPublic: true },
    });

    // Check most things stayed the same...
    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    // Check that isPublic and version were updated
    expect(relation.isPublic).toBe(true);
    expect(relation.version).toBe(2);
  });

  it("should update relation type and reverse with a single version increment", async () => {
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(relation.version).toBe(1);

    const newRelationType = defaultRelationTypes.author;
    expect(newRelationType).toBeDefined();
    expect(relation.relationType).not.toBe(newRelationType);

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        relationType: newRelationType,
      },
      reverse: true,
    });

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(relation.relationType).toEqual(newRelationType);
    expect(relation.version).toBe(2);
    expect(relation.from.allRelationsList.has(relation.id)).toBe(true);
    expect(relation.to.allRelationsList.has(relation.id)).toBe(true);
  });

  it("should generate a working revert function", async () => {
    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPublic: true,
      },
      reverse: true,
    });

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(relation.isPublic).toBe(true);
    expect(relation.version).toBe(2);

    graphStore.updateManager.revertAllPending();

    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(relation.isPublic).toBe(false);
    expect(relation.version).toBe(1);
  });

  it("should queue a GraphUpdate for updating a relation", async () => {
    const relationAtStart = relation.serialize();

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPublic: true,
      },
    });

    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [{ operation: "updateRelation", oldProps: relationAtStart, newProps: relation.serialize() }],
    ]);
  });

  it("should queue appropriate GraphUpdates when reversing a relation", async () => {
    const relationAtStart = relation.serialize();
    const startNodeRelationPositionAtStart = graphStore.getRelationList(startNode).get(relation.id)?.position;
    const endNodeRelationPositionAtStart = graphStore.getRelationList(endNode).get(relation.id)?.position;

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPublic: true,
      },
      reverse: true,
    });

    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        { operation: "updateRelation", oldProps: relationAtStart, newProps: relation.serialize() },
        {
          operation: "updateRelationList",
          nodeId: startNode.id,
          authorId: startNode.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: startNodeRelationPositionAtStart,
          newPosition: graphStore.getRelationList(startNode).get(relation.id)?.position,
          oldIsPublic: false,
          newIsPublic: true,
        },
        {
          operation: "updateRelationList",
          nodeId: endNode.id,
          authorId: endNode.authorId,
          pinned: false,
          relationId: relation.id,
          oldPosition: endNodeRelationPositionAtStart,
          newPosition: graphStore.getRelationList(endNode).get(relation.id)?.position,
          oldIsPublic: false,
          newIsPublic: true,
        },
      ],
    ]);
  });

  it("should be able to set a relation type by label, inferring direction", async () => {
    const relTypeAndDir = graphStore.getRelationTypeByLabel("author");
    expect(relTypeAndDir).toBeDefined();
    const { relationType: authorRelationType, direction } = relTypeAndDir!;
    expect(authorRelationType.label).toBe("author");
    expect(authorRelationType.reverseLabel).toBe("authored");
    expect(direction).toBe("forward");

    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(relation.relationType).not.toBe(authorRelationType);

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        relationTypeLabel: "author",
      },
    });

    expect(relation.relationType).toBe(authorRelationType);
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        relationTypeLabel: "authored",
      },
    });

    expect(relation.relationType).toBe(authorRelationType);
    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
  });

  it("should be able to set a relation type by label, creating a new type if none exists", async () => {
    let relTypeAndDir = graphStore.getRelationTypeByLabel("test");
    expect(relTypeAndDir).toBeUndefined();

    expect(relation.relationType.label).not.toBe("test");

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        relationTypeLabel: "test",
      },
    });

    relTypeAndDir = graphStore.getRelationTypeByLabel("test");
    expect(relTypeAndDir).toBeDefined();
    expect(relTypeAndDir?.relationType.label).toBe("test");
    expect(relTypeAndDir?.direction).toBe("forward");
    expect(relation.relationType).toBe(relTypeAndDir?.relationType);
  });

  it("should be able to swap the direction of a relation while preserving the position", async () => {
    const oldFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const oldToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(oldFromPosition).toBeDefined();
    expect(oldToPosition).toBeDefined();
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    await graphStore.updateRelation({
      relationId: relation.id,
      reverse: true,
    });

    const newFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const newToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(newFromPosition).toEqual(oldToPosition);
    expect(newToPosition).toEqual(oldFromPosition);

    await graphStore.updateRelation({
      relationId: relation.id,
      reverse: true,
    });

    const finalFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const finalToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(finalFromPosition).toEqual(oldFromPosition);
    expect(finalToPosition).toEqual(oldToPosition);
  });

  it("should be able to swap the direction of a relation while preserving the position, then undo, then redo", async () => {
    const oldFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const oldToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(oldFromPosition).toBeDefined();
    expect(oldToPosition).toBeDefined();
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    await graphStore.updateRelation({
      relationId: relation.id,
      reverse: true,
    });

    const newFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const newToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(newFromPosition).toEqual(oldToPosition);
    expect(newToPosition).toEqual(oldFromPosition);

    graphStore.updateManager.undo();

    const revertedFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const revertedToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(revertedFromPosition).toEqual(oldFromPosition);
    expect(revertedToPosition).toEqual(oldToPosition);

    graphStore.updateManager.redo();

    const finalFromPosition = startNode.allRelationsList.get(relation.id)?.position;
    const finalToPosition = endNode.allRelationsList.get(relation.id)?.position;

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(finalFromPosition).toEqual(oldToPosition);
    expect(finalToPosition).toEqual(oldFromPosition);
  });

  it("should be able to select several nodes, move them to a new parent, and then undo and redo all of it", async () => {
    const parent = await graphStore.addNode({ nodeProps: { id: "parent" } });

    const { node: child1, relation: relation1 } = await graphStore.addChildNode({
      parentId: "parent",
      nodeProps: { id: "child1" },
    });
    const { node: child2, relation: relation2 } = await graphStore.addChildNode({
      parentId: "parent",
      nodeProps: { id: "child2" },
    });
    const { node: child3, relation: relation3 } = await graphStore.addChildNode({
      parentId: "parent",
      nodeProps: { id: "child3" },
    });

    expect(relation1.to).toBe(child1);
    expect(relation1.from).toBe(parent);
    expect(relation2.to).toBe(child2);
    expect(relation2.from).toBe(parent);
    expect(relation3.to).toBe(child3);
    expect(relation3.from).toBe(parent);

    const initialPositionList = parent.relationsSortedByPosition;

    await graphStore.updateRelationPositionsList({
      containingNodeId: "parent",
      groupId: "all",
      objectAndRelationIds: [{ objectId: child1.id, relationId: relation1.id }],
      afterObjectId: relation3.id,
    });

    const reorderedPositionList = parent.relationsSortedByPosition;
    expect(initialPositionList[0]).toBe(reorderedPositionList[2]);

    graphStore.updateManager.undo();
    const undonePositionList = parent.relationsSortedByPosition;
    expect(undonePositionList).toEqual(initialPositionList);

    graphStore.updateManager.redo();
    const redonePositionList = parent.relationsSortedByPosition;
    expect(redonePositionList).toEqual(reorderedPositionList);
  });
});
