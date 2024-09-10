import { action, autorun, isObservable, makeAutoObservable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { SublistTree } from "@/app/tree/SublistTree";
import { Path, Root, Tree } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/types";

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";
  public flattenSublists: boolean = false;

  public viewType = ViewType.Outline;
  public treeView: Tree;
  public sublistView: Tree;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.makeObservable();
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
}
