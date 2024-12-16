import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphStore } from "@/app/graph/GraphStore";
import { PlaceholderGraphObject } from "@/app/graph/PlaceholderGraphObject";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";

import { MIN_NUM_NODES_WITH_USER, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore.load", () => {
  let graphStore: GraphStore;

  const NUM_START_NODES = MIN_NUM_NODES_WITH_USER;
  const NUM_START_RELATIONS = MIN_NUM_RELATIONS;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(MOCK_MEW_USER);
    graphStore.updateManager.cleanup();
  });

  it("should be able to load a simple serialized graph store", () => {
    expect(graphStore.nodesById.size).toEqual(NUM_START_NODES);
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS);

    const testData: SerializedGraphStore = {
      usersById: {},
      nodesById: {
        a: {
          id: "a",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          content: [{ type: "text", value: "Node a content" }],
          isPublic: false,
          isNewRelatedObjectsPublic: false,
          canonicalRelationId: null,
          isChecked: null,
        },
        b: {
          id: "b",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          content: [{ type: "text", value: "Node b content" }],
          isPublic: false,
          isNewRelatedObjectsPublic: false,
          canonicalRelationId: null,
          isChecked: null
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
          updatedAt: new Date(),
          fromId: "a",
          toId: "b",
          relationTypeId: "test-rt",
          isPublic: false,
          canonicalRelationId: null,
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
      noteContentRelationsByNodeId: {
        a: {
          "a-test-rt-b": { int: 0, frac: "0" },
        },
      },
    };

    graphStore.load(testData);

    expect(graphStore.nodesById.size).toEqual(NUM_START_NODES + 2);
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS + 1);

    const loadedRelation = graphStore.getRelation("a-test-rt-b");
    expect(loadedRelation).toBeDefined();
    expect(loadedRelation?.from.id).toEqual("a");
    expect(loadedRelation?.to.id).toEqual("b");
    expect(loadedRelation?.relationType.id).toEqual("test-rt");
    expect(new Set(graphStore.getNode("a")?.noteContentRelationsList.keys)).toEqual(new Set(["a-test-rt-b"]));
  });

  it("should be able to handle a cycle of hyper-relations without placeholders", () => {
    expect(graphStore.relationsById.size).toEqual(NUM_START_RELATIONS);

    const testData: SerializedGraphStore = {
      usersById: {},
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
          updatedAt: new Date(),
          fromId: "b",
          toId: "c",
          relationTypeId: "test-rt",
          isPublic: false,
          canonicalRelationId: null,
        },
        b: {
          id: "b",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          fromId: "a",
          toId: "c",
          relationTypeId: "test-rt",
          isPublic: false,
          canonicalRelationId: null,
        },
        c: {
          id: "c",
          authorId: "author",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          fromId: "a",
          toId: "b",
          relationTypeId: "test-rt",
          isPublic: false,
          canonicalRelationId: null,
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
      noteContentRelationsByNodeId: {},
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
