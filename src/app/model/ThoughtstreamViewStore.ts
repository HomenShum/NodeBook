import { GraphNode } from "./GraphNode";
import { GraphStore } from "./GraphStore";
import { Note } from "./ThoughtstreamNote";
import { ViewStore } from "./ViewStore";

export class ThoughtstreamViewStore {
  private graphStore: GraphStore;
  private viewStore: ViewStore;

  private viewsByNodeId: Map<string, Note>;

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    this.viewsByNodeId = new Map();
  }

  get focusedNode() {
    return this.viewStore.focusedNode;
  }

  viewForNode(node: GraphNode) {
    const existing = this.viewsByNodeId.get(node.id);
    if (existing) return existing;

    const note = new Note(this, node);
    this.viewsByNodeId.set(node.id, note);
    return note;
  }
}
