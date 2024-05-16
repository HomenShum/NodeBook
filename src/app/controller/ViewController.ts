import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";
import { JUMP_TO_START } from "../editor/plugins/JumpSelectionPluigin";
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
  targetView: ViewType;
  alwaysAddToOutline?: boolean;
}

export class ViewController {
  private graphStore: GraphStore;

  public focusedNode: Path | null = null;
  public hoveredNode: Path | null = null;

  public searchQuery: string = "";

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
  public showAtSignOnMention = true;
  public hideThoughtstreamBullets = true;
  public hideBulletBackgroundIfParentsOnly = true;
  public searchAndReplaceDropdown: "labelled-only" | "all" | "none" = "labelled-only";
  public disableCycles = true;
  public atSignTriggerToReplaceObject = false;
  public addStreamLabeledRelationsToMyLists = true;

  // TODO do we need this right now?
  public relatedNodesViewType: "all" | "pinned" = "all";

  public currentOutlineViewRoot: GraphRelation[] | null = null;
  public currentStreamViewRoot: GraphRelation[] | null = null;

  constructor(graphStore: GraphStore) {
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

  setAtSignTriggerToReplaceObject(value: boolean) {
    this.atSignTriggerToReplaceObject = value;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  setSearchAndReplaceDropdown(value: "labelled-only" | "all" | "none") {
    this.searchAndReplaceDropdown = value;
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

  setAddStreamLabeledRelationsToMyLists(value: boolean) {
    this.addStreamLabeledRelationsToMyLists = value;
  }

  setDisableCycles(value: boolean) {
    this.disableCycles = value;
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  /**
   * Moves the focus to the given node.
   */
  setFocusedNode(path: Path | null, { focusAt }: { focusAt?: "start" | "end" } = {}) {
    this.focusedNode = path;
    setTimeout(() => {
      if (!path || this.focusedNode !== path) return;
      if (focusAt === "start") {
        const editor = this.editorsByPath.get(path);
        editor?.focus();
        editor?.dispatchCommand(JUMP_TO_START, null);
      } else {
        // Cursor will be at end by default
        this.editorsByPath.get(path)?.focus();
      }
    }, 0);
  }

  /**
   * Used to track the focused node without changing the focus.
   */
  trackFocusedNode(path: Path | null) {
    this.focusedNode = path;
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

  private createThoughtstreamChildNode(focus: boolean = true, ensureInOutline: boolean = false) {
    const { node, relationToThoughtstream } = this.graphStore.createThoughtstreamChild();

    if (focus) {
      this.setFocusedNode(
        relationsToPathStr([this.graphStore.thoughtstreamRootRelationFromUserRoot, relationToThoughtstream]),
      );
    }

    if (ensureInOutline || this.graphStore.addThoughstreamDirectChildrenToOutline) {
      this.graphStore.createRelation({
        from: this.graphStore.outlineRoot,
        to: node,
        relationType: this.graphStore.relationTypesById.child,
      });
    }
    return node;
  }

  /**
   * Create a child node in the specified view, or in the current view if no view is specified.
   * In split view, the child node will be created in the same view as the focused node.
   */
  createChildNode({ focusAfterCreate, targetView, alwaysAddToOutline }: ChildNodeOptions) {
    const view = targetView;
    switch (view) {
      case ViewType.OUTLINE:
        return this.createOutlineChildNode(focusAfterCreate);
      case ViewType.THOUGHTSTREAM:
        return this.createThoughtstreamChildNode(focusAfterCreate, alwaysAddToOutline);
      case ViewType.SPLIT:
      default:
        const id = this.focusedNode?.split("/")?.[0] ?? "";
        const focusedViewRoot = this.graphStore.relationsById.get(id)?.to;
        if (!focusedViewRoot) {
          // default to creating a child in Thoughtstream (e.g. when cmd + k is pressed)
          return this.createThoughtstreamChildNode(focusAfterCreate, alwaysAddToOutline);
        } else if (focusedViewRoot.id === this.graphStore.thoughtstreamRoot.id) {
          return this.createThoughtstreamChildNode(focusAfterCreate, alwaysAddToOutline);
        } else if (focusedViewRoot.id === this.graphStore.outlineRoot.id) {
          return this.createOutlineChildNode(focusAfterCreate);
        } else {
          throw new Error("Unsupported split view root node");
        }
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
