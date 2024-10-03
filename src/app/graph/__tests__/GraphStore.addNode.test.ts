import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { SettingsStore } from "@/app/graph/SettingsStore";

import { MIN_NUM_NODES } from "./helpers";

describe("GraphStore.addNode", () => {
  let graphStore: GraphStore;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(UNLOGGED_USER, new SettingsStore());
    graphStore.updateManager.cleanup();
  });

  it("should create a new node", async () => {
    const node = await graphStore.addNode({});

    expect(node).toBeDefined();
    expect(graphStore.getNode(node.id)).toBe(node);
    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES + 1);
  });
  it("should queue a GraphUpdate for creating a node", async () => {
    const node = await graphStore.addNode({});

    // Get pendingUpdates without the transactionId for comparison
    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([[{ operation: "addNode", node: node.serialize() }]]);
  });
  it("should create a working revert operation", async () => {
    const node = await graphStore.addNode({});

    graphStore.updateManager.revertAllPending();

    expect(graphStore.getNode(node.id)).toBeUndefined();
    expect(graphStore.nodesById.size).toBe(MIN_NUM_NODES);
  });
  it("should create a public node in public mode and vice versa", async () => {
    graphStore.settings?.setPublicMode(true);
    const publicNode = await graphStore.addNode({});
    expect(graphStore.getNode(publicNode.id)).toBeDefined();
    expect(publicNode.isPublic).toBe(true);

    graphStore.settings?.setPublicMode(false);
    const privateNode = await graphStore.addNode({});
    expect(graphStore.getNode(privateNode.id)).toBeDefined();
    expect(privateNode.isPublic).toBe(false);
  });
});
