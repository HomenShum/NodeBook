import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { defaultRelationTypes, GraphStore } from "@/app/graph/GraphStore";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore initialization", () => {
  it("should initialize with a user root, outline root, and thoughtstream root", () => {
    const graphStore = new GraphStore();

    // Check root nodes are all there
    expect(graphStore.userRoot).toBeDefined();
    expect(graphStore.outlineRoot).toBeDefined();
    expect(graphStore.thoughtstreamRoot).toBeDefined();
    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES);

    // Check relations between the root nodes
    expect(graphStore.outlineRootRelationFromUserRoot).toBeDefined();
    expect(graphStore.outlineRootRelationFromUserRoot.from).toBe(graphStore.userRoot);
    expect(graphStore.outlineRootRelationFromUserRoot.to).toBe(graphStore.outlineRoot);
    expect(graphStore.thoughtstreamRootRelationFromUserRoot).toBeDefined();
    expect(graphStore.thoughtstreamRootRelationFromUserRoot.from).toBe(graphStore.userRoot);
    expect(graphStore.thoughtstreamRootRelationFromUserRoot.to).toBe(graphStore.thoughtstreamRoot);
    expect(graphStore.relationsById.size).toBe(MIN_NUM_RELATIONS);
  });
  it("should queue GraphUpdates for the creation of default objects", () => {
    const graphStore = new GraphStore(MOCK_MEW_USER);

    expect(graphStore.updateManager.pendingUpdates).toHaveLength(1);

    let addRelationTypeUpdates = 0;
    let addRelationUpdates = 0;
    let addNodeUpdates = 0;
    for (const update of graphStore.updateManager.pendingUpdates[0].updates) {
      if (update.operation === "addRelationType") {
        addRelationTypeUpdates += 1;
        expect(update.relationType.authorId).toBe(MOCK_MEW_USER.id);
      } else if (update.operation === "addRelation") {
        addRelationUpdates += 1;
        expect(update.relation.authorId).toBe(MOCK_MEW_USER.id);
      } else if (update.operation === "addNode") {
        addNodeUpdates += 1;
        expect(update.node.authorId).toBe(MOCK_MEW_USER.id);
      }
    }

    expect(addRelationTypeUpdates).toBe(Object.keys(defaultRelationTypes).length);
    expect(addRelationUpdates).toBe(MIN_NUM_RELATIONS);
    expect(addNodeUpdates).toBe(MIN_NUM_NODES);
  });
});
