import { action, autorun, isObservable, makeAutoObservable } from "mobx";
import { LexicalEditor } from "lexical";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { SublistTree } from "@/app/tree/SublistTree";
import { Path, Root, Tree } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/types";
import { makeAutoSaving } from "@/app/util";

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";
  public flattenSublists: boolean = false;

  public viewType = ViewType.Outline;
  public treeView: Tree;
  public sublistView: Tree;

  public hoveredNode: Path | null = null;

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public isDarkMode = false;
  public sidebarWidth = 268;
  public activeModal: "devTools" | "importData" | "clearData" | "setPublic" | null = null;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
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
    autorun(() => {
      if (!this.settingsStore.isFlattenSublistsEnabled) {
        this.setFlattenSublists(false);
      }
    });
  }

  /**
   * Return state associated with the main view.
   * When we introduced sublists, we had to split the view into two separate trees.
   * This method returns the appropriate tree based on the current view type and flatten sublists setting.
   */
  get mainView() {
    return this.flattenSublists ? this.sublistView : this.treeView;
  }

  setRoot(root: Root, path: Path) {
    this.treeView.setRoot(root, path);
    this.sublistView.setRoot(root, path);
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this, {
        setViewType: action,
        setSearchQuery: action,
        setFlattenSublists: action,
      });
    }
  }

  setViewType(viewType: ViewType) {
    this.viewType = viewType;
  }

  setFlattenSublists(flattenSublists: boolean) {
    this.flattenSublists = flattenSublists;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    this.treeView.setSearch(query);
    this.sublistView.setSearch(query);
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
}
