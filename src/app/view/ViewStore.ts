import { makeAutoObservable } from "mobx";

import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { Tree } from "@/app/view/Tree";

export type PathData = { isExpanded: boolean; isPinnedExpanded: boolean };

export class ViewStore {
  private settingsStore: SettingsStore;
  private graphStore: GraphStore;
  public searchQuery: string = "";

  public mainStreamView: Tree;
  public mainOutlineView: Tree;
  public sidebarTrees: Tree[] = [];

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.mainStreamView = new Tree(graphStore, this.settingsStore, [graphStore.thoughtstreamRootRelationFromUserRoot]);
    this.mainOutlineView = new Tree(graphStore, this.settingsStore, [graphStore.outlineRootRelationFromUserRoot]);
    makeAutoObservable(this);
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    [this.mainStreamView, this.mainOutlineView, ...this.sidebarTrees].forEach((view) =>
      view.updateFilter({ search: query }),
    );
  }

  openSidebarOutlineView(path: GraphRelation[]) {
    const newView = new Tree(this.graphStore, this.settingsStore, path);
    this.sidebarTrees.unshift(newView);
    return newView;
  }

  clear() {
    this.mainOutlineView.clear([this.graphStore.outlineRootRelationFromUserRoot]);
    this.mainStreamView.clear([this.graphStore.thoughtstreamRootRelationFromUserRoot]);
    this.sidebarTrees = [];
  }

  serialize(): SerializedViewStore {
    return {
      mainStreamView: this.mainStreamView.serialize(),
      mainOutlineView: this.mainOutlineView.serialize(),
      sidebarOutlineViews: this.sidebarTrees.map((view) => view.serialize()),
    };
  }

  deserializeInPlace(data: SerializedViewStore) {
    this.mainStreamView.deserializeInPlace(data.mainStreamView);
    this.mainOutlineView.deserializeInPlace(data.mainOutlineView);
    this.sidebarTrees = data.sidebarOutlineViews.map((viewData) => {
      const view = new Tree(this.graphStore, this.settingsStore, []);
      view.deserializeInPlace(viewData);
      return view;
    });
  }
}
