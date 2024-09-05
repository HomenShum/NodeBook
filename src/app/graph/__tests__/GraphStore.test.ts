import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { defaultRelationTypes, GraphStore } from "@/app/graph/GraphStore";

import { MIN_NUM_NODES, MIN_NUM_RELATIONS } from "./helpers";

describe("GraphStore initialization", () => {
  it("should initialize with default objects", () => {
    const graphStore = new GraphStore();
    expect(graphStore.userRoot).toBeDefined();
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
