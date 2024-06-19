import { action, makeObservable, observable } from "mobx";
import { createContext, useContext } from "react";

import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path } from "@/app/graph/GraphStore";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { relationsPathToParentChild } from "@/app/util";

import { PathData } from "./ViewStore";

/**
 * Represents a view of the graph, starting from a root path and expanding
 * downwards into a tree according to the specified expanded paths.
 *
 * Note: This class is used by both the outline and thoughstream views. The
 * thoughtstream view doesn't look like a tree, but it is still represented
 * as a tree behind the scenes.
 */
export class Tree {
  constructor(
    private graphStore: GraphStore,
    public root: GraphRelation[],
    private pathData: Map<Path, PathData> = observable.map(),
  ) {
    makeObservable(this, {
      root: observable,
      setRoot: action,
    });
  }

  setRoot(root: GraphRelation[]) {
    this.root = root;
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

  async createChildNode() {
    const path = relationsPathToParentChild(this.root);
    const root = path[path.length - 1].child;
    const { node, relation } = await this.graphStore.addChildNode({ parentId: root.id });
    return { node, relation, path: [...this.root, relation] };
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    this.pathData.set(path, { isExpanded });
  }

  clear(root: GraphRelation[]) {
    this.root = root;
    this.pathData.clear();
  }

  serialize(): SerializedTree {
    return {
      root: this.root.map((r) => r.id).join("/"),
      pathData: Object.fromEntries(this.pathData.entries()),
    };
  }

  /**
   * Returns true if the deserialization was successful.
   */
  deserializeInPlace(data: SerializedTree): boolean {
    const pathData = new Map<Path, PathData>();
    if (data.pathData) {
      for (const [key, value] of Object.entries(data.pathData)) {
        pathData.set(key, value);
      }
    }
    this.pathData = pathData;
    const relations: GraphRelation[] = [];
    for (const id of data.root.split("/")) {
      const relation = this.graphStore.relationsById.get(id);
      if (!relation) {
        this.root = [this.graphStore.outlineRootRelationFromUserRoot];
        return false;
      }
      relations.push(relation);
    }
    this.root = relations;
    return true;
  }
}

export const TreeContext = createContext<Tree | null>(null);

export const useTree = () => {
  const tree = useContext(TreeContext);
  if (!tree) {
    throw new Error("useOutline must be used within an OutlineProvider");
  }
  return tree;
};
