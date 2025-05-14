import { LexicalEditor } from "lexical";
import { action, computed, isObservable, makeAutoObservable, observable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { SearchTree } from "@/app/tree/SearchTree";
import { SelectionState } from "@/app/tree/SelectionState";
import { SublistTree } from "@/app/tree/SublistTree";
import { Path, Root, Tree } from "@/app/tree/Tree";
import { makeAutoSaving } from "@/app/util";
import { AiSearchStore } from "@/app/view/AiSearchStore";
import { ViewType } from "@/app/view/types";

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";
  public quickCaptureSearchQuery: string = "";
  public flattenSublists: boolean = false;
  public cardMode: boolean = false;

  /**
   * When a value is provided, ImageViewer component renders a
   * image that covers the whole screen
   */
  public srcForImageViewer: string | null = null;

  public quickCaptureViewType = ViewType.Note;
  public treeView: Tree;
  public sublistView: Tree;
  public searchView: SearchTree;
  public quickCaptureSearchView: QuickCaptureSearchTree;

  public hoveredNode: Path | null = null;

  private isDown: boolean = false;
  private isDragging: boolean = false;
  public isMouseUpAfterDrag: boolean = true;
  private minDist: number = 10; // Minimum distance to consider dragging
  private downX: number = 0;
  private downY: number = 0;

  editorsByPath: Map<string, LexicalEditor> = new Map();

  processingNodeIds: Set<string> = new Set();

  public leftSidebarOpen = false;
  public rightSidePanelOpen = false;
  public quickCaptureOpen = false;
  public isDarkMode = false;
  public sidebarWidth = 268;
  public rightSidePanelWidth = 50; // Percentage of screen width
  public activeModal: "devTools" | "importData" | "clearData" | "setPublic" | "help" | null = null;
  public isCommandBarOpen: boolean = false;
  private deepSearching: boolean = false;
  private quickCaptureDeepSearching: boolean = false;
  public sidePanelTrees: Tree[] = [];
  public quickCaptureTree: Tree;
  public activeTree: Tree;
  public notificationPaneOpen = false;
  public jumpToNodeId: string | null = null;
  public aiSearchStore = new AiSearchStore();
  public evictNonVisibleIds: () => void;

  // Stack to store scroll positions with their corresponding object IDs
  private scrollPositionStack: Array<{ position: number }> = [];

  /**
   * History of selection states for undo operations.
   * Maps transaction IDs to selection states.
   */
  @observable.shallow
  selectionStates: Map<string, SelectionState> = new Map();

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.isCommandBarOpen = false;
    this.makeObservable();
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidePanelOpen: true,
      isDarkMode: true,
      sidebarWidth: true,
      activeModal: true,
      cardMode: true,
      sidePanelTrees: false,
      quickCaptureViewType: true,
      quickCaptureOpen: true,
      srcForImageViewer: false,
    });

    // Define evictNonVisibleIds as a bound method in constructor
    this.evictNonVisibleIds = action(() => {
      setTimeout(() => {
        if (this.graphStore && this.activeTree) {
          const [visibleNodeIds, visibleRelationIds] = this.getVisibleIds();
          this.graphStore.evictSearchCache(visibleNodeIds, visibleRelationIds);
        }
      }, 1000);
    });

    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.treeView = new Tree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser(), { isMainTree: true });
    this.sublistView = new SublistTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.searchView = new SearchTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser(), true);
    this.quickCaptureSearchView = new QuickCaptureSearchTree(
      graphStore,
      this.settingsStore,
      graphStore.getDefaultRootForUser(),
    );
    this.activeTree = this.treeView;
    this.quickCaptureTree = new QuickCaptureTree(this.graphStore, this.settingsStore, this.graphStore.myStreamNode, {
      viewType: this.quickCaptureViewType,
    });

    // Set up event listener for selection state tracking from Tree operations
    if (typeof window !== "undefined") {
      window.addEventListener("track-selection-state", ((event: CustomEvent) => {
        if (event.detail) {
          this.trackSelectionState(event.detail.selectionState, event.detail.transactionId);
        }
      }) as EventListener);

      // Set up event listener for restoring selection state after undo operations
      window.addEventListener("restore-selection-state", ((event: CustomEvent) => {
        if (event.detail && event.detail.transactionId) {
          this.restoreSelectionStateByTransactionId(event.detail.transactionId);
        }
      }) as EventListener);
    }
  }
  /**
   * Return state associated with the main view.
   * When we introduced sublists, we had to split the view into two separate trees.
   * This method returns the appropriate tree based on the current view type and flatten sublists setting.
   */
  get mainView() {
    if (this.deepSearching) {
      return this.searchView;
    } else if (this.flattenSublists) {
      return this.sublistView;
    } else {
      return this.treeView;
    }
  }

  get quickCaptureView(): Tree {
    if (this.quickCaptureDeepSearching) {
      return this.quickCaptureSearchView;
    }
    return this.quickCaptureTree;
  }

  setAiSearchState(aiState: Partial<AiSearchStore>) {
    this.aiSearchStore = { ...this.aiSearchStore, ...aiState };
  }

  setRoot(root: Root) {
    this.treeView.setRoot(root);
    this.sublistView.setRoot(root);
    this.searchView.setRoot(root);
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this, {
        setViewType: action,
        setQuickCaptureViewType: action,
        setSearchQuery: action,
        setQuickCaptureSearchQuery: action,
        setFlattenSublists: action,
        setCommandBarOpen: action,
        isMouseUpAfterDrag: observable,
        handleMouseDown: action,
        handleMouseMove: action,
        handleMouseUp: action,
        setDeepSearching: action,
        setQuickCaptureDeepSearching: action,
        isDeepSearching: computed,
        isQuickCaptureDeepSearching: computed,
        createSidePanelTree: action,
        deleteSidePanelTree: action,
        openQuickCapture: action,
        closeQuickCapture: action,
        setActiveTree: action,
        toggleRightSidePanel: action,
        setNodeIsProcessing: action,
        setAiSearchState: action,
        clearNodeIsProcessing: action,
        isNodeProcessing: observable,
        cancelDeepSearch: action,
        cancelQuickCaptureDeepSearch: action,
        quickCaptureView: computed,
        setNotificationPaneOpen: action,
        jumpToNodeId: observable,
        setSrcForImageViewer: action,
        saveScrollPosition: action,
        restoreScrollPosition: action,
        selectionStates: observable.shallow,
        trackSelectionState: action,
        restoreSelectionStateByTransactionId: action,
      });
    }
  }

  setSrcForImageViewer(src: string | null) {
    this.srcForImageViewer = src;
  }

  setDeepSearching(deepSearching: boolean) {
    this.deepSearching = deepSearching;
  }

  setQuickCaptureDeepSearching(deepSearching: boolean) {
    this.quickCaptureDeepSearching = deepSearching;
  }

  setViewType(viewType: ViewType): void {
    this.settingsStore.setViewMode(this.mainView.rootObjectId, viewType);
  }

  get viewType(): ViewType {
    return this.settingsStore.getViewMode(this.mainView.rootObjectId);
  }

  setQuickCaptureViewType(viewType: ViewType) {
    this.quickCaptureViewType = viewType;
    this.quickCaptureTree = new QuickCaptureTree(
      this.graphStore,
      this.settingsStore,
      this.graphStore.getDefaultRootForUser(),
      {
        viewType: this.quickCaptureViewType,
      },
    );
  }

  setFlattenSublists(flattenSublists: boolean) {
    this.flattenSublists = flattenSublists;
  }

  toggleCardMode() {
    this.cardMode = !this.cardMode;
  }

  setSearchQuery(query: string) {
    // We modify the search bar selectively with logic encoded in the SearchBar class.
    this.searchQuery = query;
    this.searchView.clearSearch(this.treeView.root);
    this.searchView.deepSearch(query);

    // Trigger a custom event that the SearchBar can listen to
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("update-search-input", { detail: query }));
    }
  }

  setQuickCaptureSearchQuery(query: string) {
    if (!this.quickCaptureTree) return;
    this.quickCaptureSearchQuery = query;
    this.quickCaptureSearchView.clearSearch(this.quickCaptureTree.root);
    this.quickCaptureSearchView.deepSearch(query);
  }

  get isDeepSearching() {
    return this.deepSearching;
  }

  get isQuickCaptureDeepSearching() {
    return this.quickCaptureDeepSearching;
  }

  cancelDeepSearch() {
    // By setting deepSearching to false, we will exit out of the search tree view.
    this.setDeepSearching(false);
    this.setSearchQuery("");
    this.searchView.clearSearch(this.treeView.root);
  }

  cancelQuickCaptureDeepSearch() {
    if (!this.quickCaptureTree) return;
    this.setQuickCaptureDeepSearching(false);
    this.setQuickCaptureSearchQuery("");
    this.quickCaptureSearchView.clearSearch(this.quickCaptureTree.root);
  }

  getVisibleIds() {
    const [activeTreeVisibleNodeIds, activeTreeVisibleRelationIds] = this.activeTree.getVisibleIds();
    if (!this.treeView.isMainTree) {
      const [mainTreeVisibleNodeIds, mainTreeVisibleRelationIds] = this.treeView.getVisibleIds();
      mainTreeVisibleNodeIds.forEach((id) => activeTreeVisibleNodeIds.add(id));
      mainTreeVisibleRelationIds.forEach((id) => activeTreeVisibleRelationIds.add(id));
    }
    return [activeTreeVisibleNodeIds, activeTreeVisibleRelationIds];
  }

  cleanup() {
    this.setActiveModal(null);
    this.treeView.clear(this.graphStore.getDefaultRootForUser());
    this.sublistView.clear(this.graphStore.getDefaultRootForUser());
  }

  serialize(): SerializedViewStore {
    return {
      mainView: this.treeView.serialize(),
    };
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  setActiveModal(modal: "devTools" | "importData" | "clearData" | "setPublic" | "help" | null) {
    this.activeModal = modal;
  }

  registerEditor(pathStr: Path, editor: LexicalEditor) {
    this.editorsByPath.set(pathStr, editor);
  }

  removeEditor(pathStr: Path) {
    this.editorsByPath.delete(pathStr);
  }

  setSidebarWidth(width: number) {
    this.sidebarWidth = width;
  }

  setRightSidePanelWidth(width: number) {
    this.rightSidePanelWidth = width;
  }

  setCommandBarOpen(open: boolean) {
    this.isCommandBarOpen = open;
    if (open) {
      this.graphStore.enableSearchCache();
    }
  }

  createSidePanelTree(root: Root) {
    this.rightSidePanelOpen = true;
    this.sidePanelTrees.unshift(new Tree(this.graphStore, this.settingsStore, root));
  }

  deleteSidePanelTree(treeId: string) {
    this.sidePanelTrees = this.sidePanelTrees.filter((tree) => tree.id != treeId);
    if (this.sidePanelTrees.length === 0) {
      this.rightSidePanelOpen = false;
    }
  }

  toggleQuickCapture() {
    this.quickCaptureOpen = !this.quickCaptureOpen;
  }

  openQuickCapture(createNode = false) {
    //Since quickCaptureTree is stored in memory, it keeps track of a stale selection state
    //delete stale selection state before rendering it.
    this.mainView.selection = null;
    this.quickCaptureTree.selection = null;
    this.quickCaptureOpen = true;
    if (this.graphStore.user.isAnonymous) {
      return;
    }
    document.getElementById(this.quickCaptureTree.id)?.scroll(0, 0);
    createNode ? this.quickCaptureTree.createChildOfRootAndFocus() : this.quickCaptureTree.focus();
  }

  closeQuickCapture() {
    this.quickCaptureOpen = false;
  }

  setActiveTree(tree: Tree) {
    if (this.activeTree.id === tree.id) return;
    this.activeTree = tree;
  }

  toggleRightSidePanel() {
    this.rightSidePanelOpen = !this.rightSidePanelOpen;
  }

  // Mouse event handlers
  handleMouseMove = (e: MouseEvent) => {
    if (this.isDown && !this.isDragging) {
      // Only register as dragging if the mouse has moved a certain distance
      if (Math.abs(e.clientX - this.downX) + Math.abs(e.clientY - this.downY) > this.minDist) {
        this.isDragging = true;
        this.isMouseUpAfterDrag = false;
      }
    }
  };

  handleMouseDown = (e: MouseEvent) => {
    this.isDown = true;
    this.isMouseUpAfterDrag = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  handleMouseUp = () => {
    if (this.isDragging) {
      this.isMouseUpAfterDrag = true;
    }

    this.isDown = false;
    this.isDragging = false;
  };

  startObservingMouse() {
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  stopObservingMouse() {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }

  setNodeIsProcessing(nodeId: string) {
    this.processingNodeIds.add(nodeId);
  }

  clearNodeIsProcessing(nodeId: string) {
    this.processingNodeIds.delete(nodeId);
  }

  isNodeProcessing(nodeId: string) {
    return this.processingNodeIds.has(nodeId);
  }

  setNotificationPaneOpen(state: boolean) {
    this.notificationPaneOpen = state;
  }

  // Save scroll position for a given object ID
  saveScrollPosition(objectId: string) {
    if (typeof window !== "undefined") {
      const contentContainer = document.querySelector("[data-scroll-id='ContentContainer']");
      if (contentContainer) {
        this.scrollPositionStack.push({
          position: contentContainer.scrollTop,
        });
      }
    }
  }

  // Restore scroll position for the previous page
  restoreScrollPosition(currentObjectId: string) {
    // Find and remove the last matching position for this object ID
    const index = this.scrollPositionStack.length - 1;
    if (index !== -1) {
      const { position } = this.scrollPositionStack[index];
      // Remove this and all subsequent positions from the stack
      this.scrollPositionStack.pop();

      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          const contentContainer = document.querySelector("[data-scroll-id='ContentContainer']");
          if (contentContainer) {
            contentContainer.scrollTop = position;
          }
        });
      }
    }
  }

  /**
   * Tracks a selection state that should be restored if the associated operation is undone
   *
   * @param state The selection state to track
   * @param transactionId The ID of the associated transaction
   */
  trackSelectionState(state: SelectionState, transactionId: string) {
    this.selectionStates.set(transactionId, state);

    // Clean up old entries if the map gets too large
    if (this.selectionStates.size > 100) {
      // Remove oldest entries (more complex than before, but necessary with a Map)
      const entriesToRemove = this.selectionStates.size - 100;
      if (entriesToRemove > 0) {
        const keysToRemove = Array.from(this.selectionStates.keys()).slice(0, entriesToRemove);
        keysToRemove.forEach((key) => this.selectionStates.delete(key));
      }
    }
  }

  /**
   * Restores a selection state by transaction ID
   *
   * @param transactionId The ID of the transaction being undone
   * @returns true if the selection state was found and restored, false otherwise
   */
  restoreSelectionStateByTransactionId(transactionId: string): boolean {
    const state = this.selectionStates.get(transactionId);
    if (!state) return false;

    // Remove the state from the map
    this.selectionStates.delete(transactionId);

    // Get the tree to apply the selection to
    const tree = this.getTreeByType(state.treeType);
    if (!tree) return false;

    // For better UX, when restoring selection, we should scroll to center
    // This makes it clearer where we ended up after an undo operation
    const scrollToCenter = true;

    // Determine if we should be in edit mode
    // For many operations, we want to be ready to edit after undo
    const editMode =
      state.operation === "NEW_SIBLING_BELOW_CURRENT" ||
      state.operation === "SPLIT_NOTE" ||
      state.operation === "BACKSPACE_MERGE"; // Add edit mode for backspace merge

    // When undoing a BACKSPACE_MERGE, the selection state should restore to the source node
    // In the original SelectionState, nodeId is the source node ID, and previousNodeId is the target node ID
    // For BACKSPACE_MERGE, we need to find the recreated source node's path
    let editorPath = state.editorPath;

    // For backspace merges, set the cursor position
    let position = state.position;

    if (state.operation === "BACKSPACE_MERGE") {
      // For backspace merges, we need to find the recreated source node
      // The best approach is to use a proper tree traversal (or a more direct lookup)
      // to find the node with matching ID after undo recreates it

      // Look for the node with the source ID in the tree
      const nodeWithId = this.findNodePathById(tree, state.nodeId);
      if (nodeWithId) {
        editorPath = nodeWithId;
      }

      // Set cursor position to start since backspace merges happen at the start of nodes
      position = "start";
    }

    // Restore the selection
    tree.setFocusedNode(editorPath, position, editMode, scrollToCenter);
    return true;
  }

  /**
   * Find a node's path by its ID within a tree
   * @param tree The tree to search in
   * @param nodeId The ID of the node to find
   * @returns The path to the node if found, otherwise undefined
   */
  private findNodePathById(tree: Tree, nodeId: string): string | undefined {
    // Look through the tree's nodes
    const root = tree.root;
    let foundPath: string | undefined;

    // Simple recursive function to traverse the tree and find the node
    const traverseTree = (node: any, visit: (n: any) => void) => {
      visit(node);
      if (node.childrenGroups) {
        node.childrenGroups.forEach((group: any) => {
          group.nodes.forEach((child: any) => {
            traverseTree(child, visit);
          });
        });
      }
    };

    // Traverse the tree looking for the node with the given ID
    traverseTree(root, (node) => {
      if (node.object && node.object.id === nodeId && node.path) {
        foundPath = node.path;
      }
    });

    return foundPath;
  }

  /**
   * Get a tree by its type
   */
  private getTreeByType(treeType: string): Tree | null {
    switch (treeType) {
      case "main":
        return this.mainView;
      case "quickCapture":
        return this.quickCaptureView;
      default:
        // Check sidebar trees
        const sidePanelTree = this.sidePanelTrees.find((tree) => tree.id === treeType);
        if (sidePanelTree) return sidePanelTree;
        return null;
    }
  }
}
