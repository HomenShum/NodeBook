import { generateKeyBetween } from "fractional-indexing";
import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphStore } from "./GraphStore";
import { Note } from "./ThoughtstreamNote";
import { ViewStore } from "./ViewStore";

export class ThoughtstreamViewStore {
  private graphStore: GraphStore;
  private viewStore: ViewStore;
  private viewsByNodeId: Map<string, Note>;
  private topNodePosition: string | null;

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    this.viewsByNodeId = new Map();
    this.topNodePosition = null;
    makeAutoObservable(this);
  }

  getNote(id: string) {
    return this.viewsByNodeId.get(id);
  }

  setFocusedNode(node: Note | null) {
    this.viewStore.setFocusedNode(node);
  }

  get focusedNode() {
    return this.viewStore.focusedNode;
  }

  get notes() {
    const nodes = this.graphStore.nodes
      .filter((note) => !note.isRoot)
      .filter((node) => node.thoughtstreamPosition !== undefined)
      .sort((a, b) => (a.thoughtstreamPosition! < b.thoughtstreamPosition! ? -1 : 1));

    if (!nodes.length) return [];

    this.topNodePosition = nodes[0].thoughtstreamPosition!;
    return nodes.map((node) => this.viewForNode(node));
  }

  registerNodeView(view: Note) {
    this.viewStore.registerNodeView(view);
  }

  removeNodeView(view: Note) {
    this.viewStore.removeNodeView(view);
  }

  viewForNode(node: GraphNode) {
    const existing = this.viewsByNodeId.get(node.id);
    if (existing) return existing;

    const note = new Note(this, node);
    this.viewsByNodeId.set(node.id, note);
    return note;
  }

  createNote() {
    const graphRoot = this.graphStore.getRoot();
    const { node } = graphRoot!.createRelatedNode();
    node.thoughtstreamPosition = generateKeyBetween(null, this.topNodePosition);
    this.topNodePosition = node.thoughtstreamPosition;
    return this.viewForNode(node);
  }

  deleteNote(note: Note) {
    this.viewsByNodeId.delete(note.graphNode.id);
    this.graphStore.deleteNode(note.graphNode.id);
  }
}
