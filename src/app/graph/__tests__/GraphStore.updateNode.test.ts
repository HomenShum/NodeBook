import { MOCK_NODEBOOK_USER } from "@/app/auth/NodeBookUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { MIN_NUM_NODES } from "./helpers";

describe("GraphStore.updateNode", () => {
  let graphStore: GraphStore;

  let node: GraphNode;

  const NUM_START_NODES = MIN_NUM_NODES + 1;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(MOCK_NODEBOOK_USER);

    node = await graphStore.addNode({
      nodeProps: {
        id: "test-node",
        content: "test content",
        createdAt: new Date(1994, 5, 4),
      },
    });

    graphStore.updateManager.cleanup();
  });

  it("should create a new node", async () => {
    expect(node).toBeDefined();
    expect(graphStore.getNode(node.id)).toBe(node);
    expect(graphStore.nodesById.size).toBe(NUM_START_NODES);
    expect(node.content).toEqual([{ type: "text", value: "test content" }]);

    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content" },
    });

    expect(graphStore.getNode(node.id)).toBe(node);
    expect(graphStore.nodesById.size).toBe(NUM_START_NODES);
    expect(node.content).toEqual([{ type: "text", value: "new content" }]);
  });
  it("mark the todo as completed", async () => {
    expect(node).toBeDefined();
    expect(graphStore.getNode(node.id)).toBe(node);
    expect(graphStore.nodesById.size).toBe(NUM_START_NODES);

    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content", isChecked: true },
    });

    expect(node.isChecked).toEqual(true);

    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content", isChecked: false },
    });

    expect(node.isChecked).toEqual(false);
  });
  it("should create a working revert operation", async () => {
    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content" },
    });

    graphStore.updateManager.revertAllPending();

    expect(node.content).toEqual([{ type: "text", value: "test content" }]);
  });
  it("should queue a GraphUpdate for creating a node", async () => {
    const nodeAtStart = node.serialize();

    await graphStore.updateNode({
      nodeId: node.id,
      nodeProps: { content: "new content" },
    });

    // Get pendingUpdates without the transactionId for comparison
    const pendingUpdateSets: GraphUpdate[][] = graphStore.updateManager.pendingUpdates.map((update) => update.updates);
    expect(pendingUpdateSets).toEqual([
      [{ operation: "updateNode", oldProps: nodeAtStart, newProps: node.serialize() }],
    ]);
  });
});
