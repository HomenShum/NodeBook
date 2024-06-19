import { makeAutoObservable } from "mobx";

import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";
import { Tree } from "@/app/view/Tree";

export type PathData = { isExpanded: boolean };

export class ViewStore {
  private settingsStore: SettingsStore;
  private graphStore: GraphStore;

  public mainStreamView: Tree;
  public mainOutlineView: Tree;
  public sidebarOutlineViews: Tree[] = [];

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.mainStreamView = new Tree(graphStore, [graphStore.thoughtstreamRootRelationFromUserRoot]);
    this.mainOutlineView = new Tree(graphStore, [graphStore.outlineRootRelationFromUserRoot]);
    makeAutoObservable(this);
  }

  openSidebarOutlineView(path: GraphRelation[]) {
    const newView = new Tree(this.graphStore, path);
    this.sidebarOutlineViews.unshift(newView);
    return newView;
  }

  clear() {
    this.mainOutlineView.clear([this.graphStore.outlineRootRelationFromUserRoot]);
    this.mainStreamView.clear([this.graphStore.thoughtstreamRootRelationFromUserRoot]);
    this.sidebarOutlineViews = [];
  }

  serialize(): SerializedViewStore {
    return {
      mainStreamView: this.mainStreamView.serialize(),
      mainOutlineView: this.mainOutlineView.serialize(),
      sidebarOutlineViews: this.sidebarOutlineViews.map((view) => view.serialize()),
    };
  }

  deserializeInPlace(data: SerializedViewStore) {
    this.mainStreamView.deserializeInPlace(data.mainStreamView);
    this.mainOutlineView.deserializeInPlace(data.mainOutlineView);
    this.sidebarOutlineViews = data.sidebarOutlineViews.map((viewData) => {
      const view = new Tree(this.graphStore, []);
      view.deserializeInPlace(viewData);
      return view;
    });
  }
}
