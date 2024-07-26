import { GraphStore } from "@/app/graph/GraphStore";

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
});
