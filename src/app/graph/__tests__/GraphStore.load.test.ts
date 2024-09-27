import { GraphStore } from "@/app/graph/GraphStore";
import { PlaceholderGraphObject } from "@/app/graph/PlaceholderGraphObject";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.load", () => {
  let graphStore: GraphStore;

  const NUM_START_NODES = MIN_NUM_NODES;
  const NUM_START_RELATIONS = MIN_NUM_RELATIONS;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore();
    graphStore.updateManager.cleanup();
  });

  it("should be able to load a simple serialized graph store", () => {
    expect(graphStore.nodesById.size).toEqual(NUM_START_NODES);
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS);

    const testData: SerializedGraphStore = {
      nodesById: {
        a: {
          id: "a",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          content: [{ type: "text", value: "Node a content" }],
          isPublic: false,
          isBundle: false,
          isZone: false,
          isNewRelatedObjectsPublic: false,
        },
        b: {
          id: "b",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          content: [{ type: "text", value: "Node b content" }],
          isPublic: false,
          isBundle: false,
          isZone: false,
          isNewRelatedObjectsPublic: false,
        },
      },
      relationTypesById: {
        "test-rt": {
          id: "test-rt",
          authorId: "author",
          version: 1,
          label: "test relation type label",
          reverseLabel: "test reverse label",
          isPublic: false,
        },
      },
      relationsById: {
        "a-test-rt-b": {
          id: "a-test-rt-b",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          fromId: "a",
          toId: "b",
          relationTypeId: "test-rt",
          isPublic: false,
        },
      },
      relationsByNodeId: {
        a: {
          "a-test-rt-b": { int: 0, frac: "0" },
        },
        b: {
          "a-test-rt-b": { int: 0, frac: "0" },
        },
      },
      pinnedRelationsByNodeId: {},
    };

    graphStore.load(testData);

    expect(graphStore.nodesById.size).toEqual(NUM_START_NODES + 2);
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS + 1);

    const loadedRelation = graphStore.getRelation("a-test-rt-b");
    expect(loadedRelation).toBeDefined();
    expect(loadedRelation?.from.id).toEqual("a");
    expect(loadedRelation?.to.id).toEqual("b");
    expect(loadedRelation?.relationType.id).toEqual("test-rt");
  });

  it("should be able to handle a cycle of hyper-relations without placeholders", () => {
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS);

    const testData: SerializedGraphStore = {
      nodesById: {},
      relationTypesById: {
        "test-rt": {
          id: "test-rt",
          authorId: "author",
          version: 1,
          label: "test relation type label",
          reverseLabel: "test reverse label",
          isPublic: false,
        },
      },
      relationsById: {
        a: {
          id: "a",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          fromId: "b",
          toId: "c",
          relationTypeId: "test-rt",
          isPublic: false,
        },
        b: {
          id: "b",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          fromId: "a",
          toId: "c",
          relationTypeId: "test-rt",
          isPublic: false,
        },
        c: {
          id: "c",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          fromId: "a",
          toId: "b",
          relationTypeId: "test-rt",
          isPublic: false,
        },
      },
      relationsByNodeId: {
        a: {
          b: { int: 0, frac: "0" },
          c: { int: 1, frac: "1" },
        },
        b: {
          a: { int: 0, frac: "0" },
          c: { int: 1, frac: "1" },
        },
        c: {
          a: { int: 0, frac: "0" },
          b: { int: 1, frac: "1" },
        },
      },
      pinnedRelationsByNodeId: {},
    };

    graphStore.load(testData);

    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS + 3);

    const loadedRelationA = graphStore.getRelation("a");
    expect(loadedRelationA).toBeDefined();
    expect(loadedRelationA?.from.id).toEqual("b");
    expect(loadedRelationA?.from instanceof PlaceholderGraphObject).toBeFalsy();
    expect(loadedRelationA?.to.id).toEqual("c");
    expect(loadedRelationA?.to instanceof PlaceholderGraphObject).toBeFalsy();

    const loadedRelationB = graphStore.getRelation("b");
    expect(loadedRelationB).toBeDefined();
    expect(loadedRelationB?.from.id).toEqual("a");
    expect(loadedRelationB?.from instanceof PlaceholderGraphObject).toBeFalsy();
    expect(loadedRelationB?.to.id).toEqual("c");
    expect(loadedRelationB?.to instanceof PlaceholderGraphObject).toBeFalsy();

    const loadedRelationC = graphStore.getRelation("c");
    expect(loadedRelationC).toBeDefined();
    expect(loadedRelationC?.from.id).toEqual("a");
    expect(loadedRelationC?.from instanceof PlaceholderGraphObject).toBeFalsy();
    expect(loadedRelationC?.to.id).toEqual("b");
    expect(loadedRelationC?.to instanceof PlaceholderGraphObject).toBeFalsy();
  });
});
