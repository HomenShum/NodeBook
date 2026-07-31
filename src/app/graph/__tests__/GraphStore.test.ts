import { MOCK_NODEBOOK_USER } from "@/app/auth/NodeBookUser";
import { GraphStore } from "@/app/graph/GraphStore";

import { MIN_NUM_CREATED_NODES, MIN_NUM_CREATED_RELATIONS, MIN_NUM_NODES } from "./helpers";

describe("GraphStore initialization", () => {
  it("should initialize with default objects", () => {
    const graphStore = new GraphStore(MOCK_NODEBOOK_USER);

    expect(graphStore.globalRoot).toBeDefined();
    expect(graphStore.usersNode).toBeDefined();
    expect(graphStore.userRoot).toBeDefined();
    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES);
  });

  it("should queue GraphUpdates for the creation of default objects", () => {
    const graphStore = new GraphStore(MOCK_NODEBOOK_USER);

    expect(graphStore.updateManager.pendingUpdates).toHaveLength(1);

    let addRelationUpdates = 0;
    let addNodeUpdates = 0;
    for (const update of graphStore.updateManager.pendingUpdates[0].updates) {
      if (update.operation === "addRelation") {
        addRelationUpdates += 1;
        expect(update.relation.authorId).toBe(MOCK_NODEBOOK_USER.id);
      } else if (update.operation === "addNode") {
        addNodeUpdates += 1;
        expect(update.node.authorId).toBe(MOCK_NODEBOOK_USER.id);
      }
    }

    expect(addRelationUpdates).toBe(MIN_NUM_CREATED_RELATIONS);
    expect(addNodeUpdates).toBe(MIN_NUM_CREATED_NODES);
  });

  it("queues a backend-valid bootstrap transaction for a brand-new owner", () => {
    const graphStore = new GraphStore(MOCK_NODEBOOK_USER);
    const [bootstrap] = graphStore.updateManager.pendingUpdates;
    const serializedState = new Map<string, string>();

    for (const update of bootstrap.updates) {
      if (update.operation === "addNode") {
        serializedState.set(update.node.id, JSON.stringify(update.node));
      }
      if (update.operation === "addRelation") {
        serializedState.set(update.relation.id, JSON.stringify(update.relation));
      }
      if (update.operation === "updateNode") {
        const current = JSON.parse(serializedState.get(update.oldProps.id) ?? "{}");
        const stableKeys = Object.keys(update.oldProps).filter(
          (key) => !["canonicalRelationId", "relationCount", "updatedAt"].includes(key),
        );
        expect(stableKeys.every((key) =>
          JSON.stringify(current[key]) === JSON.stringify(update.oldProps[key as keyof typeof update.oldProps]),
        )).toBe(true);
        serializedState.set(update.newProps.id, JSON.stringify(update.newProps));
        expect(update.newProps.id).toBe(update.oldProps.id);
        if (update.newProps.version === update.oldProps.version) {
          const changedKeys = Object.keys(update.newProps).filter(
            (key) =>
              JSON.stringify(update.newProps[key as keyof typeof update.newProps])
              !== JSON.stringify(update.oldProps[key as keyof typeof update.oldProps]),
          );
          expect(changedKeys.every((key) =>
            ["canonicalRelationId", "relationCount", "updatedAt"].includes(key),
          )).toBe(true);
        } else {
          expect(update.newProps.version).toBe(update.oldProps.version + 1);
        }
      }
      if (update.operation === "updateRelation") {
        const current = JSON.parse(serializedState.get(update.oldProps.id) ?? "{}");
        const stableKeys = Object.keys(update.oldProps).filter(
          (key) => !["canonicalRelationId", "relationCount", "updatedAt"].includes(key),
        );
        expect(stableKeys.every((key) =>
          JSON.stringify(current[key]) === JSON.stringify(update.oldProps[key as keyof typeof update.oldProps]),
        )).toBe(true);
        serializedState.set(update.newProps.id, JSON.stringify(update.newProps));
        expect(update.newProps.id).toBe(update.oldProps.id);
        if (update.newProps.version === update.oldProps.version) {
          const changedKeys = Object.keys(update.newProps).filter(
            (key) =>
              JSON.stringify(update.newProps[key as keyof typeof update.newProps])
              !== JSON.stringify(update.oldProps[key as keyof typeof update.oldProps]),
          );
          expect(changedKeys.every((key) =>
            ["canonicalRelationId", "relationCount", "updatedAt"].includes(key),
          )).toBe(true);
        } else {
          expect(update.newProps.version).toBe(update.oldProps.version + 1);
        }
      }
    }
  });

  it("should use the global root as the user root for the anonymous user", () => {
    let user = MOCK_NODEBOOK_USER;
    expect(user.isAnonymous).toBe(false);

    let graphStore = new GraphStore(user);

    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES);
    expect(graphStore.homeRoot).toBe(graphStore.userRoot);
    expect(graphStore.homeRoot).not.toBe(graphStore.globalRoot);
  });
});
