import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphNodeView } from "./GraphNodeView";
import { GraphStore } from "./GraphStore";
import { OutlineViewStore } from "./OutlineViewStore";
import { ThoughtstreamViewStore } from "./ThoughtstreamViewStore";

export enum ViewType {
  OUTLINE = "outline",
  THOUGHTSTREAM = "thoughtstream",
  SPLIT = "split",
}

export class ViewStore {
  public curView: ViewType;

  private graphStore: GraphStore;

  public outlineViewStore: OutlineViewStore;
  public thoughtstreamViewStore: ThoughtstreamViewStore;

  private rootNode: GraphNode | null = null;

  public focusedNode: GraphNodeView | null = null;
  public hoveredNode: GraphNodeView | null = null;

  private editorsByViewId: Map<string, any> = new Map();

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
    this.editorsByViewId.clear();
    this.curView = view;
  }

  setFocusedNode(nodeView: GraphNodeView | null) {
    this.focusedNode = nodeView;
    setTimeout(() => {
      const editor = this.editorsByViewId.get(nodeView?.id ?? "");
      if (editor) {
        editor.focus();
      }
    }, 0);
  }

  setHoveredNode(node: GraphNodeView | null) {
    this.hoveredNode = node;
  }

  setShowNodeDetails(show: boolean) {
    this.showNodeDetails = show;
  }

  registerEditor(view: GraphNodeView, editor: any) {
    this.editorsByViewId.set(view.id, editor);
  }

  removeEditor(view: GraphNodeView) {
    this.editorsByViewId.delete(view.id);
  }
}
