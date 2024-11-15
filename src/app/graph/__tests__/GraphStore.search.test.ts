import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";

describe("GraphStore.search", () => {
  let graphStore: GraphStore;

  let orphanNode: GraphNode;
  let nodeA: GraphNode;
  let nodeB: GraphNode;
  let nodeC: GraphNode;
  let nodeD: GraphNode;
  let nodeE: GraphNode;
  let relationAB: GraphRelation;
  let relationBC: GraphRelation;
  let relationCD: GraphRelation;
  let relationDA: GraphRelation;
  let relationBE: GraphRelation;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(MOCK_MEW_USER);

    orphanNode = await graphStore.addNode({});
    nodeA = await graphStore.addNode({ nodeProps: { id: "a", content: "abcd" } });
    nodeB = await graphStore.addNode({ nodeProps: { id: "b", content: "abc" } });
    nodeC = await graphStore.addNode({ nodeProps: { id: "c", content: "x" } });
    nodeD = await graphStore.addNode({ nodeProps: { id: "d", content: "xyz" } });
    nodeE = await graphStore.addNode({ nodeProps: { id: "e", content: "xy" } });
    graphStore.updateManager.cleanup();
  });
  it("should match string prefix with a single character", () => {
    const results = graphStore.search({
      text: "x",
      filters: {
        types: ["node"],
      },
    });
    expect(results.nodes.map((n) => n.node.id)).toEqual([nodeC.id, nodeD.id, nodeE.id]);
  });
  it("should match the string prefixes with multiple characters", () => {
    const results = graphStore.search({
      text: "ab",
      filters: {
        types: ["node"],
      },
    });
    expect(results.nodes.map((n) => n.node.id)).toEqual([nodeA.id, nodeB.id]);
  });
});
