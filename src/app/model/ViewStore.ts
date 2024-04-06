import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";
import { Box } from "../selection/utils";
import { makeAutoSaving } from "../util";
import { GraphStore } from "./GraphStore";
import { Bullet } from "./OutlineBullet";

export enum ViewType {
  OUTLINE = "outline",
  THOUGHTSTREAM = "thoughtstream",
  SPLIT = "split",
}

export class ViewStore {
  public curView: ViewType;
  private graphStore: GraphStore;

  public focusedNode: Bullet | null = null;
  public hoveredNode: Bullet | null = null;

  private editorsByViewId: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Set<Bullet> = new Set();

  public showNodeDetails = false;
  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public hideDirectParent = false;
  public hideAllRootParents = true;
  public hideAllParents = false;

  // TODO do we need this right now?
  public relatedNodesViewType: "all" | "pinned" = "all";

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
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

  setFocusedNode(nodeView: Bullet | null) {
    this.focusedNode = nodeView;
    setTimeout(() => {
      const editor = this.editorsByViewId.get(nodeView?.id ?? "");
      if (editor) {
        editor.focus();
      }
    }, 0);
  }

  isFocused(nodeView: Bullet) {
    return this.focusedNode?.id === nodeView.id;
  }

  setHoveredNode(node: Bullet | null) {
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

  registerEditor(view: Bullet, editor: LexicalEditor) {
    this.editorsByViewId.set(view.id, editor);
  }

  removeEditor(view: Bullet) {
    this.editorsByViewId.delete(view.id);
  }

  private selectionBoxToEvaluate: Box | null = null;

  // todo can we do this without editorsByViewId?
  private evaluateSelectionBox() {
    throw new Error("Method not implemented.");
    // const selectionBox = this.selectionBoxToEvaluate;
    // if (!selectionBox) return;

    // this.selectedNodes.clear();

    // // Assume user didn't mean to select anything if the selection area is very small
    // if (selectionBox.height * selectionBox.width < 25) return;

    // for (const [viewId, editor] of this.editorsByViewId.entries()) {
    //   const editorBox = editor.getRootElement()?.getBoundingClientRect();
    //   if (!editorBox) continue;
    //   if (boxesIntersect(selectionBox, editorBox)) {
    //     const view = this.graphStore.bulletsById.get(viewId);
    //     this.selectedNodes.add(view!);
    //   }
    // }

    // this.selectionBoxToEvaluate = null;
  }

  maybeSelectNodes(selectionBox: Box) {
    this.selectionBoxToEvaluate = selectionBox;
    // Use setTimeout to effectively throttle the selection box evaluation to no more than once every 100ms
    setTimeout(() => {
      this.evaluateSelectionBox();
    }, 100);
  }
}
