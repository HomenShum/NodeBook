import { LexicalEditor } from "lexical";
import { action, computed, isObservable, makeAutoObservable, observable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { SearchTree } from "@/app/tree/SearchTree";
import { SublistTree } from "@/app/tree/SublistTree";
import { Path, Root, Tree } from "@/app/tree/Tree";
import { makeAutoSaving } from "@/app/util";
import { ViewType } from "@/app/view/types";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";
  public quickCaptureSearchQuery: string = "";
  public flattenSublists: boolean = false;

  public viewType = ViewType.Outline;
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
  public rightSidebarOpen = false;
  public isDarkMode = false;
  public sidebarWidth = 268;
  public activeModal: "devTools" | "importData" | "clearData" | "setPublic" | "help" | null = null;
  public isCommandBarOpen: boolean = false;
  private deepSearching: boolean = false;
  private quickCaptureDeepSearching: boolean = false;
  public sidebarTrees: Tree[] = [];
  public quickCaptureTree: Tree | null = null;
  public activeTree: Tree;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.isCommandBarOpen = false;
    this.makeObservable();
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      isDarkMode: true,
      sidebarWidth: true,
      activeModal: true,
      sidebarTrees: false,
    });
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.treeView = new Tree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser(), { isMainTree: true });
    this.sublistView = new SublistTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.searchView = new SearchTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.quickCaptureSearchView = new QuickCaptureSearchTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.activeTree = this.treeView;
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

  get quickCaptureView(): Tree | null{
    if(this.quickCaptureDeepSearching){
      return this.quickCaptureSearchView
    }
    return this.quickCaptureTree;
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
        createSidebarTree: action,
        deleteSidebarTree: action,
        toggleQuickCapture: action,
        setActiveTree: action,
        toggleRightSidebar: action,
        setNodeIsProcessing: action,
        clearNodeIsProcessing: action,
        isNodeProcessing: observable,
        cancelDeepSearch: action,
        cancelQuickCaptureDeepSearch: action,
        quickCaptureView: computed
      });
    }
  }

  setDeepSearching(deepSearching: boolean) {
    this.deepSearching = deepSearching;
  }

  setQuickCaptureDeepSearching(deepSearching: boolean) {
    this.quickCaptureDeepSearching = deepSearching;
  }

  setViewType(viewType: ViewType) {
    this.viewType = viewType;
  }

  setQuickCaptureViewType(viewType: ViewType) {
    this.quickCaptureViewType = viewType;
  }

  setFlattenSublists(flattenSublists: boolean) {
    this.flattenSublists = flattenSublists;
  }

  setSearchQuery(query: string) {
    // We modify the search bar selectively with logic encoded in the SearchBar class.
    this.searchQuery = query;
    this.searchView.clearSearch(this.treeView.root);
    this.searchView.deepSearch(query);
  }

  setQuickCaptureSearchQuery(query: string){
    if(!this.quickCaptureTree) return;
    this.quickCaptureSearchQuery = query;
    this.quickCaptureSearchView.clearSearch(this.quickCaptureTree.root);
    this.quickCaptureSearchView.deepSearch(query);
  }

  get isDeepSearching() {
    return this.deepSearching;
  }

  get isQuickCaptureDeepSearching(){
    return this.quickCaptureDeepSearching;
  }

  cancelDeepSearch() {
    // By setting deepSearching to false, we will exit out of the search tree view.
    this.setDeepSearching(false);
    this.setSearchQuery("");
    this.searchView.clearSearch(this.treeView.root);
  }

  cancelQuickCaptureDeepSearch() {
    if(!this.quickCaptureTree) return;
    this.setQuickCaptureDeepSearching(false);
    this.setQuickCaptureSearchQuery("");
    this.quickCaptureSearchView.clearSearch(this.quickCaptureTree.root)
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

  setCommandBarOpen(open: boolean) {
    this.isCommandBarOpen = open;
  }

  createSidebarTree(root: Root) {
    this.rightSidebarOpen = true;
    this.sidebarTrees.unshift(new Tree(this.graphStore, this.settingsStore, root));
  }

  deleteSidebarTree(treeId: string) {
    this.sidebarTrees = this.sidebarTrees.filter((tree) => tree.id != treeId);
  }

  toggleQuickCapture() {
    this.quickCaptureTree = this.quickCaptureTree
      ? null
      : new QuickCaptureTree(this.graphStore, this.settingsStore, this.graphStore.getDefaultRootForUser());
  }

  setActiveTree(tree: Tree) {
    if (this.activeTree.id === tree.id) return;
    this.activeTree = tree;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
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
}
