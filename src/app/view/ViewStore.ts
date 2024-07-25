import { isObservable, makeAutoObservable } from "mobx";

import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { Tree } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/ViewType";

export class ViewStore {
  private settingsStore: SettingsStore;
  private graphStore: GraphStore;
  public searchQuery: string = "";

  public mainStreamView: Tree;
  public mainOutlineView: Tree;
  public sidebarTrees: Tree[] = [];

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.makeObservable();
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.mainStreamView = new Tree(graphStore, this.settingsStore, [graphStore.thoughtstreamRootRelationFromUserRoot]);
    this.mainOutlineView = new Tree(graphStore, this.settingsStore, [graphStore.outlineRootRelationFromUserRoot]);
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeAutoObservable(this);
    }
  }

  // TODO: This is a bit of a hack. We should probably have a more structured way of handling focus.
  // Like in our editor, you can do .focus(), .getRootElement(), etc. We should have a similar API for
  // our outline/stream views.
  focusedView(): ViewType.GRAPH | ViewType.STREAM | null {
    if (document.getElementById(ViewType.GRAPH)?.contains(document.activeElement)) {
      return ViewType.GRAPH;
    } else if (document.getElementById(ViewType.STREAM)?.contains(document.activeElement)) {
      return ViewType.STREAM;
    } else {
      return null;
    }
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    [this.mainStreamView, this.mainOutlineView].forEach((view) => view.setSearch(query));
  }

  clear() {
    this.mainOutlineView.clear([this.graphStore.outlineRootRelationFromUserRoot]);
    this.mainStreamView.clear([this.graphStore.thoughtstreamRootRelationFromUserRoot]);
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
