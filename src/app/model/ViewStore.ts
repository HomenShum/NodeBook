import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphNodeView } from "./GraphNodeView";
import { GraphStore } from "./GraphStore";
import { OutlineViewStore } from "./OutlineViewStore";
import { ThoughtstreamViewStore } from "./ThoughtstreamViewStore";

export enum ViewType {
  OUTLINE = "outline",
  THOUGHTSTREAM = "thoughtstream",
}

export class ViewStore {
  public curView: ViewType;

  private graphStore: GraphStore;

  public outlineViewStore: OutlineViewStore;
  public thoughtstreamViewStore: ThoughtstreamViewStore;

  private rootNode: GraphNode | null = null;

  public focusedNode: GraphNodeView | null = null;
  public hoveredNode: GraphNodeView | null = null;

  public showNodeDetails = true;

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
    this.outlineViewStore = new OutlineViewStore(graphStore, this);
    this.thoughtstreamViewStore = new ThoughtstreamViewStore(graphStore, this);
    makeAutoObservable(this);
  }

  setView(view: ViewType) {
    this.curView = view;
  }

  setRoot(node: GraphNode) {
    this.rootNode = node;
  }

  get currentViewRoot(): GraphNodeView | null {
    if (!this.rootNode) return null;

    switch (this.curView) {
      case "outline":
        return this.outlineViewStore.viewForNode(this.rootNode);
      case "thoughtstream":
        return this.thoughtstreamViewStore.viewForNode(this.rootNode);
      default:
        throw new Error(`Unknown view type ${this.curView}`);
    }
  }

  setFocusedNode(node: GraphNodeView | null) {
    this.focusedNode = node;
  }

  setHoveredNode(node: GraphNodeView | null) {
    this.hoveredNode = node;
  }
}
