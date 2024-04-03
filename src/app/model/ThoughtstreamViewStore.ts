import { makeAutoObservable } from "mobx";
import { compareFractionIndices } from "../util";
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
    return this.graphStore.nodes
      .filter((node) => !node.isRoot)
      .sort((a, b) => compareFractionIndices(a.thoughtstreamPosition, b.thoughtstreamPosition))
      .map((node) => this.viewForNode(node));
  }

  registerNodeView(view: Note) {
    this.viewStore.registerNodeView(view);
  }

  removeNodeView(view: Note) {
    this.viewStore.removeNodeView(view);
  }

  viewForNode(node: GraphNode): Note {
    const existing = this.viewsByNodeId.get(node.id);
    if (existing) return existing;

    const note = new Note(this, node);
    this.viewsByNodeId.set(node.id, note);
    return note;
  }

  createNote() {
    const { node } = this.graphStore.root.createRelatedNode();
    return this.viewForNode(node);
  }

  deleteNote(note: Note) {
    this.viewsByNodeId.delete(note.graphNode.id);
    this.graphStore.deleteNode(note.graphNode.id);
  }
}
