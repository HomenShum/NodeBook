import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";
import { GraphRelation } from "../model/GraphRelation";
import { GraphStore, Path } from "../model/GraphStore";
import { Box } from "../selection/utils";
import { makeAutoSaving, relationsPathToParentChild, relationsToPathStr } from "../util";

export enum ViewType {
  OUTLINE = "outline",
  THOUGHTSTREAM = "thoughtstream",
  SPLIT = "split",
}

interface ChildNodeOptions {
  focusAfterCreate: boolean;
  targetView?: ViewType;
}

export class ViewController {
  public curView: ViewType;
  private graphStore: GraphStore;

  public focusedNode: Path | null = null;
  public hoveredNode: Path | null = null;

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Path[] = [];

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;

  // Dev bar toggles
  public showNodeDetails = false;
  public hideDirectParent = true;
  public hideAllRootParents = true;
  public hideAllParents = false;
  public hideBackrelations = false;
  public hideBundles = true;
  public hideZones = false;
  public showAtSignOnMention = false;
  public hideThoughtstreamBullets = true;
  public hideBulletBackgroundIfParentsOnly = true;

  // TODO do we need this right now?
  public relatedNodesViewType: "all" | "pinned" = "all";

  public currentOutlineViewRoot: GraphRelation[] | null = null;
  public currentStreamViewRoot: GraphRelation[] | null = null;

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
    this.currentOutlineViewRoot = [graphStore.outlineRootRelationFromUserRoot];
    this.currentStreamViewRoot = [graphStore.thoughtstreamRootRelationFromUserRoot];
    makeAutoObservable(this);
    makeAutoSaving(this, {
      showNodeDetails: true,
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      hideDirectParent: true,
    });
  }

  setShowAtSignOnMention(show: boolean) {
    this.showAtSignOnMention = show;
  }

  setCurrentStreamViewRoot(root: GraphRelation[] | null) {
    this.currentStreamViewRoot = root;
  }

  setCurrentOutlineViewRoot(root: GraphRelation[] | null) {
    this.currentOutlineViewRoot = root;
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  setView(view: ViewType) {
    this.curView = view;

    if (view === ViewType.OUTLINE) {
      // Reset root when switching into outline view (ENT-3278)
      this.currentOutlineViewRoot = [this.graphStore.outlineRootRelationFromUserRoot];
    }
  }

  setFocusedNode(path: Path | null) {
    this.focusedNode = path;
    setTimeout(() => {
      if (!path || this.focusedNode !== path) return;
      this.editorsByPath.get(path)?.focus();
    }, 0);
  }

  isFocused(path: Path) {
    return this.focusedNode === path;
  }

  setHoveredNode(path: Path | null) {
    this.hoveredNode = path;
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

  setHideBackrelations(show: boolean) {
    this.hideBackrelations = show;
  }

  setHideBundles(show: boolean) {
    this.hideBundles = show;
  }

  setHideZones(show: boolean) {
    this.hideZones = show;
  }

  setHideThoughtstreamBullets(hide: boolean) {
    this.hideThoughtstreamBullets = hide;
  }

  setHideBulletBackgroundIfParentsOnly(hide: boolean) {
    this.hideBulletBackgroundIfParentsOnly = hide;
  }

  registerEditor(pathStr: Path, editor: LexicalEditor) {
    this.editorsByPath.set(pathStr, editor);
  }

  removeEditor(pathStr: Path) {
    this.editorsByPath.delete(pathStr);
  }

  private createOutlineChildNode(focus: boolean = true) {
    const path = relationsPathToParentChild(this.currentOutlineViewRoot!);
    const root = path[path.length - 1].child;
    const { node, relation } = this.graphStore.createChildNode(root);

    if (focus) {
      this.setFocusedNode(relationsToPathStr([...this.currentOutlineViewRoot!, relation]));
    }

    if (this.graphStore.addAllOutlineDescendantsToThoughtstream) {
      this.graphStore.addToThoughtstream(node);
    }

    return node;
  }

  private createThoughtstreamChildNode(focus: boolean = true) {
    const { node, relationToThoughtstream } = this.graphStore.createThoughtstreamChild();

    if (focus) {
      this.setFocusedNode(
        relationsToPathStr([this.graphStore.thoughtstreamRootRelationFromUserRoot, relationToThoughtstream]),
      );
    }

    if (this.graphStore.addThoughstreamDirectChildrenToOutline) {
      this.graphStore.createRelation({
        from: this.graphStore.outlineRoot,
        to: node,
        relationType: this.graphStore.relationTypesById.child,
      });
    }
    return node;
  }

  createChildNode({ focusAfterCreate, targetView }: ChildNodeOptions = { focusAfterCreate: true }) {
    switch (targetView) {
      case ViewType.OUTLINE:
        return this.createOutlineChildNode(focusAfterCreate);
      case ViewType.THOUGHTSTREAM:
        return this.createThoughtstreamChildNode(focusAfterCreate);
      case ViewType.SPLIT:
      default:
        // In split view default to creating a child in Thoughtstream (e.g. when cmd + k is pressed)
        return this.createThoughtstreamChildNode(focusAfterCreate);
    }
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
