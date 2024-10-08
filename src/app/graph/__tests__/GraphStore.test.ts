import { MOCK_MEW_USER, UNLOGGED_USER } from "@/app/auth/MewUser";
import { GraphStore } from "@/app/graph/GraphStore";
import { defaultRelationTypes } from "@/app/graph/constants";

import {
  MIN_NUM_CREATED_NODES,
  MIN_NUM_CREATED_RELATIONS,
  MIN_NUM_NODES_WITH_ANONYMOUS_USER,
  MIN_NUM_NODES_WITH_USER,
} from "./helpers";

describe("GraphStore initialization", () => {
  it("should initialize with default objects", () => {
    const graphStore = new GraphStore(MOCK_MEW_USER);

    expect(graphStore.globalRoot).toBeDefined();
    expect(graphStore.usersNode).toBeDefined();
    expect(graphStore.userRoot).toBeDefined();
    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES_WITH_USER);
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
    expect(addRelationUpdates).toBe(MIN_NUM_CREATED_RELATIONS);
    expect(addNodeUpdates).toBe(MIN_NUM_CREATED_NODES);
  });

  it("should use the global root as the user root for the anonymous user", () => {
    let user = MOCK_MEW_USER;
    expect(user.isAnonymous).toBe(false);

    let graphStore = new GraphStore(user);

    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES_WITH_USER);
    expect(graphStore.homeRoot).toBe(graphStore.userRoot);
    expect(graphStore.homeRoot).not.toBe(graphStore.globalRoot);

    user = UNLOGGED_USER;
    expect(user.isAnonymous).toBe(true);

    graphStore = new GraphStore(user);

    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES_WITH_ANONYMOUS_USER);
    expect(graphStore.homeRoot).toBe(graphStore.globalRoot);
  });
});
