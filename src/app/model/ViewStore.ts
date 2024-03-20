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

  public leftSidebarOpen = true;
  public rightSidebarOpen = false;

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
    this.outlineViewStore = new OutlineViewStore(graphStore, this);
    this.thoughtstreamViewStore = new ThoughtstreamViewStore(graphStore, this);
    makeAutoObservable(this);
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  setView(view: ViewType) {
    this.curView = view;
  }

  setFocusedNode(node: GraphNodeView | null) {
    this.focusedNode = node;
  }

  setHoveredNode(node: GraphNodeView | null) {
    this.hoveredNode = node;
  }
}
