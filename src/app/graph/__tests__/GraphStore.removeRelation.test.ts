import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.removeRelation", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });
  });

  describe("simple cases", () => {
    let graphStore: GraphStore;

    let startNode: GraphNode;
    let endNode: GraphNode;
    let relation: GraphRelation;

    const NUM_RELATIONS_START = MIN_NUM_RELATIONS + 1;

    beforeEach(async () => {
      graphStore = new GraphStore(MOCK_MEW_USER);

      startNode = await graphStore.addNode({});
      endNode = await graphStore.addNode({});
      relation = await graphStore.addRelation({ fromId: startNode.id, toId: endNode.id });

      graphStore.updateManager.cleanup();
    });

    it("should delete a specified relation", async () => {
      expect(relation).toBeDefined();
      expect(graphStore.getRelation(relation.id)).toBe(relation);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
      expect(startNode.relations).toHaveLength(1);
      expect(startNode.relations).toEqual(expect.arrayContaining([relation]));
      expect(endNode.relations).toHaveLength(1);
      expect(endNode.relations).toEqual(expect.arrayContaining([relation]));

      await graphStore.removeRelation({ relationId: relation.id });

      expect(graphStore.getRelation(relation.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 1);
      expect(startNode.relations).toHaveLength(0);
      expect(endNode.relations).toHaveLength(0);
    });
    it("should delete the from and to nodes if they have no other relations", async () => {
      await graphStore.removeRelation({ relationId: relation.id });

      expect(graphStore.getNode(startNode.id)).toBeUndefined();
      expect(graphStore.getNode(endNode.id)).toBeUndefined();
      expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES);
    });
    it("should queue GraphUpdates for deleting the relation and its from and to nodes", async () => {
      expect(graphStore.updateManager.pendingUpdates).toHaveLength(0);

      const serializedRelation = relation.serialize();
      const fromPos = graphStore.getRelationList(startNode).get(relation.id)?.position;
      const toPos = graphStore.getRelationList(endNode).get(relation.id)?.position;

      await graphStore.removeRelation({ relationId: relation.id });

      const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map(
        (update) => update.updates,
      );
      expect(pendingUpdateSets.length).toBe(1);
      expect(pendingUpdateSets[0].filter((u) => u.operation === "deleteRelation")).toEqual([
        {
          operation: "deleteRelation",
          deleted: {
            relation: serializedRelation,
            relationsList: [],
            fromPos,
            toPos,
            fromPinnedPos: undefined,
            toPinnedPos: undefined,
          },
        },
      ]);
    });
    it("should leave the from and to nodes if they have other relations", async () => {
      const _otherRelation = await graphStore.addRelation({ fromId: startNode.id, toId: endNode.id });
      graphStore.updateManager.cleanup();

      const serializedRelation = relation.serialize();
      const fromPos = graphStore.getRelationList(startNode).get(relation.id)?.position;
      const toPos = graphStore.getRelationList(endNode).get(relation.id)?.position;

      await graphStore.removeRelation({ relationId: relation.id });

      expect(graphStore.getNode(startNode.id)).toBe(startNode);
      expect(graphStore.getNode(endNode.id)).toBe(endNode);
      expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES + 2);

      // Check queue has only the relation deletion, no node deletions
      const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map(
        (update) => update.updates,
      );
      expect(pendingUpdateSets.length).toBe(1);
      expect(pendingUpdateSets[0].filter((u) => u.operation === "deleteRelation")).toEqual([
        {
          operation: "deleteRelation",
          deleted: {
            relation: serializedRelation,
            relationsList: [],
            fromPos,
            toPos,
            fromPinnedPos: undefined,
            toPinnedPos: undefined,
          },
        },
      ]);
    });
    it("should create a working revert operation", async () => {
      const serializedRelation = relation.serialize();

      await graphStore.removeRelation({ relationId: relation.id });

      graphStore.updateManager.revertAllPending();

      expect(graphStore.getRelation(relation.id)?.serialize()).toEqual(serializedRelation);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
      expect(graphStore.getNode(startNode.id)?.relations.map((r) => r.serialize())).toEqual([serializedRelation]);
      expect(graphStore.getNode(endNode.id)?.relations.map((r) => r.serialize())).toEqual([serializedRelation]);
    });
  });

  describe("complex cases", () => {
    let graphStore: GraphStore;

    let nodeA: GraphNode;
    let nodeB: GraphNode;
    let nodeC: GraphNode;
    let relationAB: GraphRelation;
    let relationBC: GraphRelation;
    let relationAC: GraphRelation;
    let hyperRelation: GraphRelation;

    const NUM_NODES_START = MIN_NUM_NODES + 3;
    const NUM_RELATIONS_START = MIN_NUM_RELATIONS + 4;

    beforeEach(async () => {
      graphStore = new GraphStore(MOCK_MEW_USER);

      nodeA = await graphStore.addNode({ nodeProps: { id: "a" } });
      nodeB = await graphStore.addNode({ nodeProps: { id: "b" } });
      nodeC = await graphStore.addNode({ nodeProps: { id: "c" } });
      relationAB = await graphStore.addRelation({ id: "ab", fromId: nodeA.id, toId: nodeB.id });
      relationBC = await graphStore.addRelation({ id: "bc", fromId: nodeB.id, toId: nodeC.id });
      relationAC = await graphStore.addRelation({ id: "ac", fromId: nodeA.id, toId: nodeC.id });
      hyperRelation = await graphStore.addRelation({ id: "hyper", fromId: relationAB.id, toId: relationBC.id });

      graphStore.updateManager.cleanup();
    });

    it("should work normally on a hyperrelation", async () => {
      expect(hyperRelation).toBeDefined();
      expect(graphStore.getRelation(hyperRelation.id)).toBe(hyperRelation);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
      expect(relationAB.relations).toHaveLength(1);
      expect(relationAB.relations).toEqual(expect.arrayContaining([hyperRelation]));
      expect(relationBC.relations).toHaveLength(1);
      expect(relationBC.relations).toEqual(expect.arrayContaining([hyperRelation]));

      const serializedHyperRelation = hyperRelation.serialize();
      const fromPos = graphStore.getRelationList(relationAB).get(hyperRelation.id)?.position;
      const toPos = graphStore.getRelationList(relationBC).get(hyperRelation.id)?.position;

      await graphStore.removeRelation({ relationId: hyperRelation.id });

      expect(graphStore.getRelation(hyperRelation.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 1);
      expect(relationAB.relations).toHaveLength(0);
      expect(relationBC.relations).toHaveLength(0);

      const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map(
        (update) => update.updates,
      );
      expect(pendingUpdateSets.length).toBe(1);
      expect(pendingUpdateSets[0].filter((u) => u.operation === "deleteRelation")).toEqual([
        {
          operation: "deleteRelation",
          deleted: {
            relation: serializedHyperRelation,
            relationsList: [],
            fromPos,
            toPos,
            fromPinnedPos: undefined,
            toPinnedPos: undefined,
          },
        },
      ]);
    });
    it("should revert properly for a hyperrelation", async () => {
      const serializedRelation = hyperRelation.serialize();

      await graphStore.removeRelation({ relationId: hyperRelation.id });

      graphStore.updateManager.revertAllPending();

      expect(graphStore.getRelation(hyperRelation.id)?.serialize()).toEqual(serializedRelation);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
      expect(graphStore.getRelation(relationAB.id)?.relations.map((r) => r.serialize())).toEqual([serializedRelation]);
      expect(graphStore.getRelation(relationBC.id)?.relations.map((r) => r.serialize())).toEqual([serializedRelation]);
    });
    it("should cascade deletion to relations of a relation", async () => {
      expect(relationAB.relations).toHaveLength(1);
      expect(relationAB.relations).toEqual(expect.arrayContaining([hyperRelation]));
      expect(relationBC.relations).toHaveLength(1);

      const serializedHyperRelation = hyperRelation.serialize();
      const hyperFromPos = graphStore.getRelationList(relationAB).get(hyperRelation.id)?.position;
      const hyperToPos = graphStore.getRelationList(relationBC).get(hyperRelation.id)?.position;
      const serializedAB = relationAB.serialize();
      const relABFromPos = graphStore.getRelationList(nodeA).get(relationAB.id)?.position;
      const relABToPos = graphStore.getRelationList(nodeB).get(relationAB.id)?.position;
      const serializedA = nodeA.serialize();
      const serializedB = nodeB.serialize();

      await graphStore.removeRelation({ relationId: relationAB.id });

      expect(graphStore.getRelation(relationAB.id)).toBeUndefined();
      expect(graphStore.getRelation(hyperRelation.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 2);
      expect(relationBC.relations).toHaveLength(0);

      const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map(
        (update) => update.updates,
      );
      expect(pendingUpdateSets).toEqual([
        [
          {
            operation: "updateNode",
            oldProps: { ...serializedA, canonicalRelationId: relationAB.id },
            newProps: { ...serializedA, canonicalRelationId: relationAC.id },
          },
          {
            operation: "updateNode",
            oldProps: { ...serializedB, canonicalRelationId: relationAB.id },
            newProps: { ...serializedB, canonicalRelationId: relationBC.id },
          },
          {
            operation: "deleteRelation",
            deleted: {
              relation: serializedAB,
              relationsList: [
                {
                  relation: serializedHyperRelation,
                  relationsList: [],
                  fromPos: hyperFromPos,
                  toPos: hyperToPos,
                  fromPinnedPos: undefined,
                  toPinnedPos: undefined,
                },
              ],
              fromPos: relABFromPos,
              toPos: relABToPos,
              fromPinnedPos: undefined,
              toPinnedPos: undefined,
            },
          },
        ],
      ]);
    });
    it("should revert properly for a relation with relations", async () => {
      const serializedRelation = relationAB.serialize();
      const serializedHyperRelation = hyperRelation.serialize();

      await graphStore.removeRelation({ relationId: relationAB.id });

      graphStore.updateManager.revertAllPending();

      expect(graphStore.getRelation(relationAB.id)?.serialize()).toEqual(serializedRelation);
      expect(graphStore.getRelation(hyperRelation.id)?.serialize()).toEqual(serializedHyperRelation);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
      expect(graphStore.getRelation(relationAB.id)?.relations.map((r) => r.serialize())).toEqual([
        serializedHyperRelation,
      ]);
      expect(graphStore.getRelation(relationBC.id)?.relations.map((r) => r.serialize())).toEqual([
        serializedHyperRelation,
      ]);
    });
    it("should correctly handle complex deletion cascades", async () => {
      expect(nodeA.relations).toHaveLength(2);
      expect(nodeC.relations).toHaveLength(2);

      await graphStore.removeRelation({ relationId: relationAC.id });

      expect(graphStore.getRelation(relationAC.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 1);
      expect(nodeA.relations).toHaveLength(1);
      expect(nodeC.relations).toHaveLength(1);
      expect(graphStore.nodesById.size).toBe(NUM_NODES_START);

      expect(relationAB.relations).toHaveLength(1);
      expect(relationAB.relations).toEqual(expect.arrayContaining([hyperRelation]));

      await graphStore.removeRelation({ relationId: relationAB.id });

      expect(graphStore.getRelation(relationAB.id)).toBeUndefined();
      expect(graphStore.getRelation(hyperRelation.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 3);
      expect(nodeA.relations).toHaveLength(0);
      expect(nodeB.relations).toHaveLength(1);
      expect(nodeC.relations).toHaveLength(1);
      expect(graphStore.nodesById.size).toBe(NUM_NODES_START - 1);
    });
    it("should be able to revert complex deletion cascades", async () => {
      const serializeAB = relationAB.serialize();
      const serializeAC = relationAC.serialize();
      const serializedHyper = hyperRelation.serialize();

      await graphStore.removeRelation({ relationId: relationAC.id });
      await graphStore.removeRelation({ relationId: relationAB.id });

      expect(graphStore.getRelation(relationAC.id)).toBeUndefined();
      expect(graphStore.getRelation(relationAB.id)).toBeUndefined();
      expect(graphStore.getRelation(hyperRelation.id)).toBeUndefined();
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START - 3);
      expect(nodeA.relations).toHaveLength(0);
      expect(nodeB.relations).toHaveLength(1);
      expect(nodeC.relations).toHaveLength(1);
      expect(graphStore.nodesById.size).toBe(NUM_NODES_START - 1);

      graphStore.updateManager.revertAllPending();

      expect(graphStore.getRelation(relationAB.id)?.serialize()).toEqual(serializeAB);
      expect(graphStore.getRelation(relationAC.id)?.serialize()).toEqual(serializeAC);
      expect(graphStore.getRelation(hyperRelation.id)?.serialize()).toEqual(serializedHyper);
      expect(graphStore.getNode(nodeA.id)?.relations).toHaveLength(2);
      expect(graphStore.getNode(nodeB.id)?.relations).toHaveLength(2);
      expect(graphStore.getNode(nodeC.id)?.relations).toHaveLength(2);
      expect(graphStore.relationsById.size).toBe(NUM_RELATIONS_START);
    });
  });
});
