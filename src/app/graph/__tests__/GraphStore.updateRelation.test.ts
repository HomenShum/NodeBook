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

    graphStore.syncQueue.clear();
  });

  it("should be able to update isPrivate and increment version properly", async () => {
    expect(relation).toBeDefined();
    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(relation.isPrivate).toBe(true);
    expect(relation.version).toBe(1);
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: { isPrivate: false },
    });

    // Check most things stayed the same...
    expect(graphStore.getRelation(relation.id)).toBe(relation);
    expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);

    // Check that isPrivate and version were updated
    expect(relation.isPrivate).toBe(false);
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
  });

  it("should generate a working undo function", async () => {
    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPrivate: false,
      },
      reverse: true,
    });

    expect(relation.from).toBe(endNode);
    expect(relation.to).toBe(startNode);
    expect(relation.isPrivate).toBe(false);
    expect(relation.version).toBe(2);

    graphStore.syncQueue.undoAllPending();

    expect(relation.from).toBe(startNode);
    expect(relation.to).toBe(endNode);
    expect(relation.isPrivate).toBe(true);
    expect(relation.version).toBe(1);
  });

  it("should queue a GraphUpdate for updating a relation", async () => {
    const relationAtStart = relation.serialize();

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPrivate: false,
      },
    });

    const pendingUpdateSets: GraphUpdate[][] = graphStore.syncQueue.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [{ operation: "updateRelation", oldProps: relationAtStart, newProps: relation.serialize() }],
    ]);
  });

  it("should queue appropriate GraphUpdates when reversing a relation", async () => {
    const relationAtStart = relation.serialize();
    const startNodeRelationsAtStart = graphStore.getRelationList(startNode).serialize();
    const endNodeRelationsAtStart = graphStore.getRelationList(endNode).serialize();

    await graphStore.updateRelation({
      relationId: relation.id,
      relationProps: {
        isPrivate: false,
      },
      reverse: true,
    });

    const pendingUpdateSets: GraphUpdate[][] = graphStore.syncQueue.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [
        { operation: "updateRelation", oldProps: relationAtStart, newProps: relation.serialize() },
        {
          operation: "updateRelationList",
          nodeId: startNode.id,
          authorId: startNode.authorId,
          pinned: false,
          listBefore: startNodeRelationsAtStart,
          listAfter: graphStore.getRelationList(startNode).serialize(),
        },
        {
          operation: "updateRelationList",
          nodeId: endNode.id,
          authorId: endNode.authorId,
          pinned: false,
          listBefore: endNodeRelationsAtStart,
          listAfter: graphStore.getRelationList(endNode).serialize(),
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
});
