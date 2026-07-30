import { MOCK_NODEBOOK_USER } from "@/app/auth/NodeBookUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";

describe("GraphStore.getAllPaths", () => {
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

    graphStore = new GraphStore(MOCK_NODEBOOK_USER);

    orphanNode = await graphStore.addNode({});
    nodeA = await graphStore.addNode({ nodeProps: { id: "a" } });
    nodeB = await graphStore.addNode({ nodeProps: { id: "b" } });
    nodeC = await graphStore.addNode({ nodeProps: { id: "c" } });
    nodeD = await graphStore.addNode({ nodeProps: { id: "d" } });
    nodeE = await graphStore.addNode({ nodeProps: { id: "e" } });
    relationAB = await graphStore.addRelation({ id: "ab", fromId: nodeA.id, toId: nodeB.id });
    relationBC = await graphStore.addRelation({ id: "bc", fromId: nodeB.id, toId: nodeC.id });
    relationBE = await graphStore.addRelation({ id: "be", fromId: nodeB.id, toId: nodeE.id });
    relationCD = await graphStore.addRelation({ id: "cd", fromId: nodeC.id, toId: nodeD.id });
    relationDA = await graphStore.addRelation({ id: "da", fromId: nodeD.id, toId: nodeA.id });
    graphStore.updateManager.cleanup();
  });

  it("should return the correct shortest path even with cycles", () => {
    const paths = graphStore.getAllPaths(nodeA, [nodeD, nodeE]);
    expect(paths).toEqual([[relationDA.id], [relationAB.id, relationBE.id]]);
  });
  it("should return null when no path exists", () => {
    const paths = graphStore.getAllPaths(nodeA, [orphanNode]);
    expect(paths).toEqual([]);
  });
});
