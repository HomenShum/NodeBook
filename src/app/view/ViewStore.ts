import { isObservable, makeAutoObservable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { Tree } from "@/app/tree/Tree";

export class ViewStore {
  private settingsStore: SettingsStore;
  private graphStore: GraphStore;
  public searchQuery: string = "";

  public viewType: "outline" | "note" = "outline";
  public mainView: Tree;

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.makeObservable();
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.mainView = new Tree(graphStore, this.settingsStore, graphStore.getDefaultRootForUser());
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this);
    }
  }

  setViewType(viewType: "outline" | "note") {
    this.viewType = viewType;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    this.mainView.setSearch(query);
  }

  cleanup() {
    this.mainView.clear(this.graphStore.getDefaultRootForUser());
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
