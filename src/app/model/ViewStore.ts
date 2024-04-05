import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";
import { Box, boxesIntersect } from "../selection/utils";
import { makeAutoSaving } from "../util";
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

  private nodeViewsById: Map<string, GraphNodeView> = new Map();
  private editorsByViewId: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Set<GraphNodeView> = new Set();

  public showNodeDetails = false;
  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public hideDirectParent = false;
  public hideAllRootParents = true;
  public hideAllParents = false;

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
    this.outlineViewStore = new OutlineViewStore(graphStore, this);
    this.thoughtstreamViewStore = new ThoughtstreamViewStore(graphStore, this);
    makeAutoObservable(this);
    makeAutoSaving(this, {
      showNodeDetails: true,
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      hideDirectParent: true,
    });
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

  setHideDirectParent(show: boolean) {
    this.hideDirectParent = show;
  }

  setHideAllRootParents(show: boolean) {
    this.hideAllRootParents = show;
  }

  setHideAllParents(show: boolean) {
    this.hideAllParents = show;
  }

  registerNodeView(view: GraphNodeView) {
    this.nodeViewsById.set(view.id, view);
  }

  removeNodeView(view: GraphNodeView) {
    this.nodeViewsById.delete(view.id);
  }

  registerEditor(view: GraphNodeView, editor: LexicalEditor) {
    this.editorsByViewId.set(view.id, editor);
  }

  removeEditor(view: GraphNodeView) {
    this.editorsByViewId.delete(view.id);
  }

  private selectionBoxToEvaluate: Box | null = null;

  private evaluateSelectionBox() {
    const selectionBox = this.selectionBoxToEvaluate;
    if (!selectionBox) return;

    this.selectedNodes.clear();

    // Assume user didn't mean to select anything if the selection area is very small
    if (selectionBox.height * selectionBox.width < 25) return;

    for (const [viewId, editor] of this.editorsByViewId.entries()) {
      const editorBox = editor.getRootElement()?.getBoundingClientRect();
      if (!editorBox) continue;
      if (boxesIntersect(selectionBox, editorBox)) {
        const view = this.nodeViewsById.get(viewId);
        this.selectedNodes.add(view!);
      }
    }

    this.selectionBoxToEvaluate = null;
  }

  maybeSelectNodes(selectionBox: Box) {
    this.selectionBoxToEvaluate = selectionBox;
    // Use setTimeout to effectively throttle the selection box evaluation to no more than once every 100ms
    setTimeout(() => {
      this.evaluateSelectionBox();
    }, 100);
  }
}
