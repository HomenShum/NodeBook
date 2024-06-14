import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";

import { JUMP_TO_END, JUMP_TO_START } from "@/app/editor/plugins/JumpSelectionPluigin";
import { Box } from "@/app/editor/selection/utils";
import { GraphStore, Path } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { makeAutoSaving, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { ViewStore } from "@/app/view/ViewStore";
import { ViewType } from "@/app/view/ViewType";

export class RenderController {
  private settingsStore: SettingsStore;
  private viewStore: ViewStore;

  // TODO: Remove tie-in to underlying GraphStore, as Render layer should only ever talk to View layer
  private graphStore: GraphStore;

  public focusedNode: Path | null = null;
  public hoveredNode: Path | null = null;

  public searchQuery: string = "";

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Path[] = [];

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;

  // TODO do we need this right now?
  public relatedNodesViewType: "all" | "pinned" = "all";

  constructor(settingsStore: SettingsStore, viewStore: ViewStore, graphStore: GraphStore) {
    this.settingsStore = settingsStore;
    this.viewStore = viewStore;
    this.graphStore = graphStore;
    makeAutoObservable(this);
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
    });
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
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
      } else if (focusAt === "end") {
        const editor = this.editorsByPath.get(path);
        editor?.focus();
        editor?.dispatchCommand(JUMP_TO_END, null);
      } else {
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

  /**
   * Focus the logical "next" editor in the view.
   *
   * "Next" here matches the what's rendered on the screen, not any properties of the graph.
   * If the focus is on a node with children and the node is expanded, that will be the first child.
   * Otherwise, it will be the next sibling, or the parent's next sibling, etc.
   *
   * @returns true if the focus was moved, false if the focus was not moved
   */
  focusNextEditor({ focusAt }: { focusAt?: "start" | "end" } = {}) {
    const editors = Array.from(document.querySelectorAll("div[data-lexical-editor='true']")) as HTMLDivElement[];
    const currentIndex = Array.from(editors).findIndex((editor) => editor === document.activeElement);
    if (currentIndex === editors.length - 1) return false;

    const curEditorDiv = editors[currentIndex];
    const nextEditorDiv = editors[currentIndex + 1];
    if (curEditorDiv.getBoundingClientRect().top > nextEditorDiv.getBoundingClientRect().top) {
      // This is a hack to prevent jumping "across the divide" (e.g. from Thoughtstream to Outline) when in split view.
      // If the "next" editor is not actually below the current editor, we don't move focus.
      // TODO: figure out something better, or decide this is Correct, Actually.
      return false;
    }

    nextEditorDiv.focus(); // After div is focused, TrackFocusedPathPlugin will call trackFocusedNode for us
    const pathFromDiv = nextEditorDiv.getAttribute("data-editor-path");
    if (pathFromDiv && focusAt === "start") {
      this.editorsByPath.get(pathFromDiv)?.dispatchCommand(JUMP_TO_START, null);
    } else if (pathFromDiv && focusAt === "end") {
      this.editorsByPath.get(pathFromDiv)?.dispatchCommand(JUMP_TO_END, null);
    }

    return true;
  }

  /**
   * Focus the logical "previous" editor in the view.
   *
   * "Previous" here matches the what's rendered on the screen, not any properties of the graph, same as focusNextEditor
   *
   * @returns true if the focus was moved, false if the focus was not moved
   */
  focusPrevEditor({ focusAt }: { focusAt?: "start" | "end" } = {}) {
    const editors = Array.from(document.querySelectorAll("div[data-lexical-editor='true']")) as HTMLDivElement[];
    const currentIndex = Array.from(editors).findIndex((editor) => editor === document.activeElement);
    if (currentIndex === 0) return false;

    const curEditorDiv = editors[currentIndex];
    const prevEditorDiv = editors[currentIndex - 1];
    if (curEditorDiv.getBoundingClientRect().top < prevEditorDiv.getBoundingClientRect().top) {
      // This is a hack to prevent jumping "across the divide" (e.g. from Outline to Thoughtstream) when in split view.
      // If the "previous" editor is not actually above the current editor, we don't move focus.
      // TODO: figure out something better, or decide this is Correct, Actually.
      return false;
    }

    prevEditorDiv.focus(); // After div is focused, TrackFocusedPathPlugin will call trackFocusedNode for us
    const pathFromDiv = prevEditorDiv.getAttribute("data-editor-path");

    if (pathFromDiv && focusAt === "start") {
      this.editorsByPath.get(pathFromDiv)?.dispatchCommand(JUMP_TO_START, null);
    } else if (pathFromDiv && focusAt === "end") {
      this.editorsByPath.get(pathFromDiv)?.dispatchCommand(JUMP_TO_END, null);
    }
    return true;
  }

  setHoveredNode(path: Path | null) {
    this.hoveredNode = path;
  }

  registerEditor(pathStr: Path, editor: LexicalEditor) {
    this.editorsByPath.set(pathStr, editor);
  }

  removeEditor(pathStr: Path) {
    this.editorsByPath.delete(pathStr);
  }

  private selectionBoxToEvaluate: Box | null = null;

  maybeSelectNodes(selectionBox: Box) {
    this.selectionBoxToEvaluate = selectionBox;
    // Use setTimeout to effectively throttle the selection box evaluation to no more than once every 100ms
    setTimeout(() => {
      // this.evaluateSelectionBox();
    }, 100);
  }

  // TODO: Move all create node logic to ViewStore
  private createOutlineChildNode(focus: boolean = true) {
    const path = relationsPathToParentChild(this.viewStore.currentOutlineViewRoot!);
    const root = path[path.length - 1].child;
    const { node, relation } = this.graphStore.createChildNode(root);

    if (focus) {
      this.setFocusedNode(relationsToPathStr([...this.viewStore.currentOutlineViewRoot!, relation]));
    }

    if (this.settingsStore.addAllOutlineDescendantsToThoughtstream) {
      this.graphStore.addToThoughtstream(node);
    }

    return node;
  }

  // TODO: Move all create node logic to ViewStore
  private createThoughtstreamChildNode(focus: boolean = true, ensureInOutline: boolean = false) {
    const { node, relationToThoughtstream } = this.graphStore.createThoughtstreamChild();

    if (focus) {
      this.setFocusedNode(
        relationsToPathStr([this.graphStore.thoughtstreamRootRelationFromUserRoot, relationToThoughtstream]),
      );
    }

    if (ensureInOutline || this.settingsStore.addThoughtstreamDirectChildrenToOutline) {
      this.graphStore.createRelation({
        from: this.graphStore.outlineRoot,
        to: node,
        relationType: this.graphStore.relationTypesById.child,
      });
    }
    return node;
  }

  // TODO: Move all create node logic to ViewStore
  /**
   * Create a child node in the specified view, or in the current view if no view is specified.
   * In split view, the child node will be created in the same view as the focused node.
   */
  createChildNode({
    focusAfterCreate,
    targetView,
    alwaysAddToOutline,
  }: {
    focusAfterCreate: boolean;
    targetView: ViewType;
    alwaysAddToOutline?: boolean;
  }) {
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
}
