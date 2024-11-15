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

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";
  public flattenSublists: boolean = false;

  public viewType = ViewType.Outline;
  public treeView: Tree;
  public sublistView: Tree;
  public searchView: SearchTree;

  public hoveredNode: Path | null = null;

  // Start mouse tracking variables

  private isDown: boolean = false;
  private isDragging: boolean = false;
  public isMouseUpAfterDrag: boolean = true;
  private minDist: number = 10; // Minimum distance to consider dragging
  private downX: number = 0;
  private downY: number = 0;

  // End mouse tracking variables

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public isDarkMode = false;
  public sidebarWidth = 268;
  public activeModal: "devTools" | "importData" | "clearData" | "setPublic" | null = null;
  public isCommandBarOpen: boolean = false;
  private deepSearching: boolean = false;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.isCommandBarOpen = false;
    this.makeObservable();
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      isDarkMode: true,
      sidebarWidth: true,
      activeModal: true,
    });
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.treeView = new Tree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.sublistView = new SublistTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.searchView = new SearchTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
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

  setRoot(root: Root, path: Path) {
    this.treeView.setRoot(root, path);
    this.sublistView.setRoot(root, path);
    this.searchView.setRoot(root, path);
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this, {
        setViewType: action,
        setSearchQuery: action,
        setFlattenSublists: action,
        setCommandBarOpen: action,
        isMouseUpAfterDrag: observable,
        handleMouseDown: action,
        handleMouseMove: action,
        handleMouseUp: action,
        setDeepSearching: action,
        isDeepSearching: computed,
      });
    }
  }

  setDeepSearching(deepSearching: boolean) {
    this.deepSearching = deepSearching;
  }

  setViewType(viewType: ViewType) {
    this.viewType = viewType;
  }

  setFlattenSublists(flattenSublists: boolean) {
    this.flattenSublists = flattenSublists;
  }

  setSearchQuery(query: string) {
    // We redo the search entirely after every modification of the search bar.
    // This is temporary; can see this being a problem with huge graphs.
    // The reason this is here for now is because Workflowy does updates to the search
    //  tree after a delay rel. to the latest update in the search bar, and I'm not sure
    //  if we want to mimic that exact same thing. We can adjust this relatively simply.

    if (query === "" && this.searchQuery !== "") {
      this.searchView.clearSearch(this.treeView.root);
      this.searchQuery = "";
      return;
    }
    this.searchQuery = query;
    this.searchView.clearSearch(this.treeView.root);
    this.searchView.deepSearch(query);
  }

  get isDeepSearching() {
    return this.deepSearching;
  }

  cancelDeepSearch() {
    // By setting deepSearching to false, we will exit out of the search tree view.
    this.setDeepSearching(false);
    this.setSearchQuery("");
    this.searchView.clearSearch(this.treeView.root);
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

  deserializeInPlace(data: SerializedViewStore) {
    this.treeView.deserializeInPlace(data.mainView);
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  setActiveModal(modal: "devTools" | "importData" | "clearData" | "setPublic" | null) {
    this.activeModal = modal;
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

  setSidebarWidth(width: number) {
    this.sidebarWidth = width;
  }

  setCommandBarOpen(open: boolean) {
    this.isCommandBarOpen = open;
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

  // End mouse event handlers
}
