import { makeAutoObservable } from "mobx";

import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedViewStore } from "@/app/persistence/SerializedData";

type PathData = { isExpanded: boolean };

export class ViewStore {
  private settingsStore: SettingsStore;
  private graphStore: GraphStore;

  public currentOutlineViewRoot: GraphRelation[] | null = null;
  public currentStreamViewRoot: GraphRelation[] | null = null;

  private pathData: Map<Path, PathData> = new Map();

  constructor(settingsStore: SettingsStore, graphStore: GraphStore) {
    this.settingsStore = settingsStore;
    this.graphStore = graphStore;
    this.currentOutlineViewRoot = [graphStore.outlineRootRelationFromUserRoot];
    this.currentStreamViewRoot = [graphStore.thoughtstreamRootRelationFromUserRoot];
    makeAutoObservable(this);
  }

  clear() {
    this.pathData.clear();
    this.currentOutlineViewRoot = [this.graphStore.outlineRootRelationFromUserRoot];
    this.currentStreamViewRoot = [this.graphStore.thoughtstreamRootRelationFromUserRoot];
  }

  setCurrentStreamViewRoot(root: GraphRelation[] | null) {
    this.currentStreamViewRoot = root;
  }

  setCurrentOutlineViewRoot(root: GraphRelation[] | null) {
    this.currentOutlineViewRoot = root;
  }

  isPathExpanded(path: Path): boolean {
    return this.pathData.get(path)?.isExpanded || false;
  }

  togglePathExpanded(path: Path) {
    const oldData = this.pathData.get(path);
    this.pathData.set(path, {
      ...oldData,
      isExpanded: !oldData?.isExpanded,
    });
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    this.pathData.set(path, { isExpanded });
  }

  serialize(): SerializedViewStore {
    return {
      pathData: Object.fromEntries(this.pathData.entries()),
    };
  }

  deserializeInPlace(data: SerializedViewStore) {
    const pathData = new Map<Path, PathData>();
    if (data.pathData) {
      for (const [key, value] of Object.entries(data.pathData)) {
        pathData.set(key, value);
      }
    }

    this.pathData = pathData;
  }
}
