import { action, isObservable, makeAutoObservable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { Tree } from "@/app/tree/Tree";
import { SublistTree } from "@/app/tree/SublistTree";

export type ViewType = "outline" | "note" | "sublist";

export class ViewStore {
  private readonly settingsStore: SettingsStore;
  private readonly graphStore: GraphStore;
  public searchQuery: string = "";

  public viewType: ViewType = "outline";
  public mainView: Tree;
  public sublistView: Tree;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.makeObservable();
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.mainView = new Tree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
    this.sublistView = new SublistTree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this, {
        setViewType: action,
        setSearchQuery: action,
      });
    }
  }

  setViewType(viewType: ViewType) {
    this.viewType = viewType;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    this.mainView.setSearch(query);
    this.sublistView.setSearch(query);
  }

  cleanup() {
    this.mainView.clear(this.graphStore.getDefaultRootForUser());
    this.sublistView.clear(this.graphStore.getDefaultRootForUser());
  }

  serialize(): SerializedViewStore {
    return {
      mainView: this.mainView.serialize(),
    };
  }

  deserializeInPlace(data: SerializedViewStore) {
    this.mainView.deserializeInPlace(data.mainView);
  }
}
