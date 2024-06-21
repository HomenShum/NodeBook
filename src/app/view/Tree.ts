import { IReactionDisposer, action, computed, makeObservable, observable, reaction } from "mobx";
import { createContext, useContext } from "react";

import { GraphNode, PositionedRelation } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path, defaultRelationTypes } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { Position, comparePositions, relationsPathToParentChild } from "@/app/util";
import appLogger from "@/lib/logger";

import { PathData } from "./ViewStore";

const logger = appLogger.child({ service: "tree" });

type RelatedObjectsGroup = "pinned" | "all";

/**
 * Represents a node in the path above the root node.
 */
export type PathToRootNode = {
  type: "path";
  object: GraphObject;
  relationToChild: GraphRelation;
  parent: PathToRootNode | null;
  child: PathToRootNode | RootTreeNode;
  path: string;
  depth: number;
};

export type RootTreeNode = {
  type: "root";
  parent: PathToRootNode | null;
  path: string;
  relationWithParent: GraphRelation | null;
  isBackrelation?: boolean;
  depth: number;
  instanceCountInPath: number;
  object: GraphObject;
  isExpanded: boolean;
  isPinnedExpanded: boolean;
  children: DescendantTreeNode[];
  pinnedChildren: DescendantTreeNode[];
  childCount: number;
  pinnedChildCount: number;
};

export type DescendantTreeNode = {
  type: "descendant";
  path: string;
  parent: RootTreeNode | DescendantTreeNode;
  position: Position;
  relationWithParent: GraphRelation;
  isBackrelation: boolean;
  siblingAbove: DescendantTreeNode | null;
  siblingBelow: DescendantTreeNode | null;
  instanceCountInPath: number;
  depth: number;
  object: GraphObject;
  isExpanded: boolean;
  isPinnedExpanded: boolean;
  children: DescendantTreeNode[];
  pinnedChildren: DescendantTreeNode[];
  childCount: number;
  pinnedChildCount: number;
  group: RelatedObjectsGroup;
  isSearchMatch: boolean;
  containsSearchMatch: boolean;
};

export type Filter = {
  search: string;
  hideBackrelations: boolean;
  hideBundles: boolean;
  hideAllParents: boolean;
  hideAllRootParents: boolean;
  hideDirectParent: boolean;
};

export type TreeNode = RootTreeNode | DescendantTreeNode;

/**
 * Get all ancestors of a tree node as an array.
 *
 * Order is from *furthest* to *closest* ancestor.
 *
 * Includes the nodes leading to the root, the root itself, and all
 * the nodes leading to the given one.
 */
export const getAncestorsAsArray = (
  node: TreeNode,
): { object: GraphObject; relationToChild: GraphRelation; path: string }[] => {
  const ancestors: { object: GraphObject; relationToChild: GraphRelation; path: string }[] = [];
  // Get up to the root and including the root
  let treeNode: TreeNode = node;
  while (treeNode.type !== "root") {
    ancestors.push({
      object: treeNode.parent.object,
      relationToChild: treeNode.relationWithParent,
      path: treeNode.parent.path,
    });
    treeNode = treeNode.parent;
  }
  // Get path nodes above the root
  let pathNode: PathToRootNode | null = treeNode.parent;
  while (pathNode) {
    ancestors.push({ object: pathNode.object, relationToChild: pathNode.relationToChild, path: pathNode.path });
    pathNode = pathNode.parent;
  }
  // Reverse the array so it goes from furthest to closest
  return ancestors.reverse();
};

/**
 * Given a relation and the id of one of the objects in the relation,
 * returns the other object in the relation.
 *
 * @throws if the id is not in the relation
 */
export const getOtherObject = (relation: GraphRelation, id: string) => {
  if (relation.from.id === id) {
    return relation.to;
  } else if (relation.to.id === id) {
    return relation.from;
  } else {
    throw new Error("Id is not in relation");
  }
};

export const isUnlabelledChild = (node: DescendantTreeNode) => {
  return node.relationWithParent.relationType.id === "child" && !node.isBackrelation;
};

export const createPath = (parentPath: string, group: RelatedObjectsGroup, relationId: string) => {
  return parentPath + "/" + group + "/" + relationId;
};

/**
 * Represents a view of the graph, starting from a root path and expanding
 * downwards into a tree according to the specified expanded paths.
 *
 * Note: This class is used by both the outline and thoughstream views. The
 * thoughtstream view doesn't look like a tree, but it is still represented
 * as a tree behind the scenes.
 */
export class Tree {
  public rootObject: GraphObject;
  public pathToRoot: GraphRelation[] = [];

  public filter: Partial<Filter> = observable.object({});
  constructor(
    private graphStore: GraphStore,
    private settingsStore: SettingsStore,
    root: GraphObject | GraphRelation[],
    // TODO make private
    public pathData: Map<Path, PathData> = new Map(),
  ) {
    if (Array.isArray(root)) {
      this.rootObject = relationsPathToParentChild(root).slice(-1)[0]?.child;
      this.pathToRoot = root;
    } else {
      this.rootObject = root;
      this.pathToRoot = [];
    }
    makeObservable(this, {
      rootObject: observable,
      pathToRoot: observable,
      setRoot: action,
      pathData: observable,
      setPathExpanded: action,
      setPinnedPathExpanded: action,
      togglePathExpanded: action,
      togglePinnedPathExpanded: action,
      rootTreeNode: computed,
    });
  }
  /**
   * Cache of object texts which we only update when the search input changes
   * (but *before* the search filter is applied to the tree). We reference these
   * texts when filtering the tree to avoid re-computing the tree every time the
   * real object text changes.
   */
  private cache = { cacheLastUpdated: 0, textsLastUpdated: 0, texts: new Map<string, string>() };
  private disposers: Map<string, IReactionDisposer> = new Map();
  private watchObjectText(object: GraphObject) {
    if (!this.disposers.has(object.id)) {
      const disposer = reaction(
        () => object.text,
        () => (this.cache.textsLastUpdated = Date.now()),
      );
      this.disposers.set(object.id, disposer);
    }
  }
  private resetObjectTextWatchers() {
    this.disposers.forEach((disposer) => disposer());
    this.disposers.clear();
  }

  updateFilter(filter: Partial<Filter>) {
    if (this.cache.cacheLastUpdated === 0 || this.cache.cacheLastUpdated !== this.cache.textsLastUpdated) {
      const root = this.rootTreeNode;
      const walk = (node: TreeNode) => {
        this.cache.texts.set(node.object.id, node.object.text.toLocaleLowerCase());
        node.children.forEach((child) => walk(child));
      };
      walk(root);
      this.cache.cacheLastUpdated = this.cache.textsLastUpdated;
    }
    Object.assign(this.filter, filter);
  }

  setRoot(root: GraphObject | GraphRelation[]) {
    logger.debug("Setting tree root", root);
    if (Array.isArray(root)) {
      const path = relationsPathToParentChild(root);
      this.rootObject = path[path.length - 1].child;
      this.pathToRoot = root;
    } else {
      this.rootObject = root;
      this.pathToRoot = [];
    }
  }

  isPathExpanded(path: Path): boolean {
    return this.pathData.get(path)?.isExpanded || false;
  }

  isPinnedExpandedAtPath(path: Path): boolean {
    return this.pathData.get(path)?.isPinnedExpanded ?? true;
  }

  togglePathExpanded(path: Path) {
    const oldData = this.pathData.get(path) || { isExpanded: false, isPinnedExpanded: true };
    this.pathData.set(path, { ...oldData, isExpanded: !oldData.isExpanded });
  }

  togglePinnedPathExpanded(path: Path) {
    console.log("togglePinnedPathExpanded");
    const oldData = this.pathData.get(path) || { isExpanded: false, isPinnedExpanded: true };
    this.pathData.set(path, { ...oldData, isPinnedExpanded: !oldData.isPinnedExpanded });
  }

  // TODO split this?
  private relatedObjectsToTreeNodes(
    parentNode: TreeNode,
    relationsWithPositions: PositionedRelation[],
    objectIdCountsInPath: { [key: string]: number },
    group: RelatedObjectsGroup,
    filter: Filter,
  ): DescendantTreeNode[] {
    return (
      relationsWithPositions
        // Map related objects to tree nodes
        .map(({ relation, position }) => {
          const path = createPath(parentNode.path, group, relation.id);
          const isBackrelation = parentNode.object.id === relation.to.id;
          const object = isBackrelation ? relation.from : relation.to;
          const instanceCountInPath = objectIdCountsInPath[object.id] || 0;
          return {
            type: "descendant" as const,
            path,
            isExpanded: this.isPathExpanded(path),
            isPinnedExpanded: this.isPinnedExpandedAtPath(path),
            object,
            instanceCountInPath,
            isBackrelation,
            parent: parentNode,
            relationWithParent: relation,
            position,
            siblingAbove: null,
            siblingBelow: null,
            depth: parentNode.depth + 1,
            children: [],
            pinnedChildren: [],
            childCount: object.relationsWithPositions.length,
            pinnedChildCount: object.pinnedRelationsWithPositions.length,
            group,
            isSearchMatch: false,
            containsSearchMatch: false,
          };
        })
        // Filter out children based on global settings
        .filter((treeNode) => {
          if (filter.hideBackrelations && treeNode.isBackrelation) {
            return false;
          }
          if (filter.hideBundles && treeNode.object instanceof GraphNode && treeNode.object.isBundle) {
            return false;
          }
          /** Parent from the perspective of the graph, not the current tree */
          const isGraphParent =
            treeNode.isBackrelation && treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id;
          if (filter.hideAllParents && isGraphParent) {
            return false;
          } else if (filter.hideAllRootParents && isGraphParent && treeNode.object.isRoot) {
            return false;
          } else if (filter.hideDirectParent && treeNode.object.id === parentNode.parent?.object.id) {
            return false;
          }
          return true;
        })
    );
  }

  /**
   * Hydrates the tree node with children and siblings recursively.
   */
  private hydrateTreeNode(parentNode: TreeNode, filter: Filter, objectIdCountsInPath: { [key: string]: number } = {}) {
    const filteredChildren = this.relatedObjectsToTreeNodes(
      parentNode,
      parentNode.object.relationsWithPositions,
      objectIdCountsInPath,
      "all",
      filter,
    );
    const filteredPinnedChildren = this.relatedObjectsToTreeNodes(
      parentNode,
      parentNode.object.pinnedRelationsWithPositions,
      objectIdCountsInPath,
      "pinned",
      filter,
    );
    // We always set the child count but only hydrate children if the parent is expanded.
    // We need the count so we can show the user there are hidden children. But it's important
    // we don't hydrate the children if the parent is collapsed, because we allow cycles in the
    // graph and we don't want to infinitely recurse.
    parentNode.childCount = filteredChildren.length;
    parentNode.pinnedChildCount = filteredPinnedChildren.length;
    // TODO: later we'll search through children even if the parent is collapsed
    let descendantsContainMatch = false;
    if (parentNode.isExpanded) {
      parentNode.children = filteredChildren
        .map((childNode) => {
          this.hydrateTreeNode(childNode, filter, {
            ...objectIdCountsInPath,
            [childNode.object.id]: childNode.instanceCountInPath + 1,
          });
          descendantsContainMatch = descendantsContainMatch || childNode.isSearchMatch || childNode.containsSearchMatch;
          return childNode;
        })
        .filter((childNode) => {
          return childNode.isSearchMatch || childNode.containsSearchMatch;
        })
        .sort((a, b) => comparePositions(a.position, b.position));
      if (parentNode.isPinnedExpanded) {
        parentNode.pinnedChildren = filteredPinnedChildren
          .map((childNode) => {
            this.hydrateTreeNode(childNode, filter, {
              ...objectIdCountsInPath,
              [childNode.object.id]: childNode.instanceCountInPath + 1,
            });
            descendantsContainMatch =
              descendantsContainMatch || childNode.isSearchMatch || childNode.containsSearchMatch;
            return childNode;
          })
          .filter((childNode) => {
            return childNode.isSearchMatch || childNode.containsSearchMatch;
          })
          .sort((a, b) => comparePositions(a.position, b.position));
      }
      // set sibling pointers
      for (let i = 0; i < parentNode.pinnedChildren.length; i++) {
        parentNode.pinnedChildren[i].siblingAbove = i > 0 ? parentNode.children[i - 1] : null;
        parentNode.pinnedChildren[i].siblingBelow =
          i < parentNode.children.length - 1 ? parentNode.children[i + 1] : null;
      }
      const lastPinned = parentNode.pinnedChildren[parentNode.pinnedChildren.length - 1];
      if (lastPinned) {
        lastPinned.siblingBelow = parentNode.children[0];
      }
      for (let i = 0; i < parentNode.children.length; i++) {
        parentNode.children[i].siblingAbove = i > 0 ? parentNode.children[i - 1] : lastPinned ?? null;
        parentNode.children[i].siblingBelow = i < parentNode.children.length - 1 ? parentNode.children[i + 1] : null;
      }
    }
    // set search match flags
    if (parentNode.type === "descendant") {
      parentNode.isSearchMatch = this.filter.search
        ? this.cache.texts.get(parentNode.object.id)?.includes(this.filter.search) ?? true
        : true;
      parentNode.containsSearchMatch = descendantsContainMatch;
    }
    this.watchObjectText(parentNode.object);
    return parentNode;
  }

  private hydratePathToRoot(root: RootTreeNode) {
    // walk up the path of relations above the root and hydrate with nodes
    let topPathNode: PathToRootNode | null = null;
    let prevNode: PathToRootNode | RootTreeNode = root;
    for (let i = this.pathToRoot.length - 1; i >= 0; i--) {
      const relation = this.pathToRoot[i];
      const nextNode: PathToRootNode = {
        type: "path",
        object: getOtherObject(relation, prevNode.object.id),
        relationToChild: relation,
        child: prevNode,
        parent: null,
        depth: 0, // provisional
        path: "", // provisional
      };
      prevNode.parent = nextNode;
      prevNode = nextNode;
    }
    topPathNode = prevNode.type === "path" ? prevNode : null;
    // then walk back down updating relevant fields
    if (topPathNode) {
      let node = topPathNode;
      while (node.child.type === "path") {
        node.child.path = node.path + "/" + node.relationToChild.id;
        node.child.depth = node.depth + 1;
        node = node.child;
      }
      root.path = node.path + "/" + node.relationToChild.id;
      root.depth = node.depth + 1;
      root.relationWithParent = node.relationToChild;
      root.isBackrelation = node.relationToChild.from.id === this.rootObject.id;
      root.isPinnedExpanded = this.isPinnedExpandedAtPath(root.path);
    }
    return root;
  }

  /**
   * Returns an object representing the state of the tree.
   * TODO: add query
   */
  get rootTreeNode(): RootTreeNode {
    logger.debug("Creating tree");
    this.resetObjectTextWatchers();
    const rootTreeNode: RootTreeNode = {
      type: "root",
      object: this.rootObject,
      // values below here are provisional until we hydrate the tree
      parent: null,
      relationWithParent: null,
      isBackrelation: false,
      path: "",
      depth: 0,
      instanceCountInPath: 0,
      isExpanded: true,
      isPinnedExpanded: true,
      children: [],
      pinnedChildren: [],
      childCount: 0,
      pinnedChildCount: 0,
    };
    const filterWithGlobalFilters: Filter = {
      hideBackrelations: this.settingsStore.hideBackrelations,
      hideBundles: this.settingsStore.hideBundles,
      hideAllParents: this.settingsStore.hideAllParents,
      hideAllRootParents: this.settingsStore.hideAllRootParents,
      hideDirectParent: this.settingsStore.hideDirectParent,
      ...this.filter,
      search: this.filter.search?.toLocaleLowerCase() || "",
    };
    this.hydratePathToRoot(rootTreeNode);
    this.hydrateTreeNode(rootTreeNode, filterWithGlobalFilters);
    return rootTreeNode;
  }

  async createChildNode() {
    const path = relationsPathToParentChild(this.pathToRoot);
    const root = path[path.length - 1].child;
    const { node, relation } = await this.graphStore.addChildNode({ parentId: root.id });
    return { node, relation, path: [...this.pathToRoot, relation] };
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    const prev: PathData = this.pathData.get(path) || { isExpanded: false, isPinnedExpanded: false };
    this.pathData.set(path, { ...prev, isExpanded });
  }

  setPinnedPathExpanded(path: Path, isExpanded: boolean) {
    const prev: PathData = this.pathData.get(path) || { isExpanded: false, isPinnedExpanded: false };
    this.pathData.set(path, { ...prev, isPinnedExpanded: isExpanded });
  }

  clear(root: GraphRelation[]) {
    this.pathToRoot = root;
    this.pathData.clear();
  }

  serialize(): SerializedTree {
    return {
      root: this.pathToRoot.map((r) => r.id).join("/"),
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
        this.pathToRoot = [this.graphStore.outlineRootRelationFromUserRoot];
        return false;
      }
      relations.push(relation);
    }
    this.pathToRoot = relations;
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
