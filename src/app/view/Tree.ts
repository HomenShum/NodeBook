import { IReactionDisposer, action, computed, makeObservable, observable, reaction } from "mobx";

import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path, defaultRelationTypes } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { Position, comparePositions, relationsPathToParentChild } from "@/app/util";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "tree" });

// TODO Can define a type for this?
export type PinnedGroup = { id: "pinned"; path: string; nodes: DescendantTreeNode[]; isExpanded: boolean };
export type AllGroup = { id: "all"; path: string; nodes: DescendantTreeNode[]; isExpanded: boolean };
type ChildrenGroups = [PinnedGroup, AllGroup];
type ChildrenGroupsById = { pinned: PinnedGroup; all: AllGroup };
type Group = PinnedGroup | AllGroup;

type PathToRootNodeProps = {
  object: GraphObject;
  relationToChild: GraphRelation;
  child: PathToRootNode | RootTreeNode;
  parent?: PathToRootNode | null;
  path?: string;
  depth?: number;
};

export type Filter = {
  hideBackrelations: boolean;
  hideBundles: boolean;
  hideAllParents: boolean;
  hideAllRootParents: boolean;
  hideDirectParent: boolean;
};

export class PathToRootNode {
  object: GraphObject;
  relationToChild: GraphRelation;
  parent: PathToRootNode | null;
  child: PathToRootNode | TreeNode;
  path: string;
  depth: number;

  constructor({ object, relationToChild, child, parent = null, path = "", depth = 0 }: PathToRootNodeProps) {
    this.object = object;
    this.relationToChild = relationToChild;
    this.parent = parent;
    this.child = child;
    this.path = path;
    this.depth = depth;
  }
}

// TODO: proper type
export class BaseTreeNode {
  object: GraphObject;
  depth: number;
  path: string;
  childrenGroups: ChildrenGroups;
  childrenGroupsById: ChildrenGroupsById;
  isExpanded: boolean;
  constructor({
    object,
    childrenGroups = [
      { id: "pinned", path: "", nodes: [], isExpanded: true },
      { id: "all", path: "", nodes: [], isExpanded: true },
    ],
    path = "",
    depth = 0,
    isExpanded = false,
  }: {
    object: GraphObject;
    childrenGroups?: ChildrenGroups;
    path?: string;
    depth?: number;
    isExpanded?: boolean;
  }) {
    this.object = object;
    this.path = path;
    this.depth = depth;
    this.childrenGroups = childrenGroups;
    this.childrenGroupsById = { pinned: childrenGroups[0], all: childrenGroups[1] };
    this.isExpanded = isExpanded;
  }

  get childCount(): number {
    return this.childrenGroups.reduce((acc, group) => acc + group.nodes.length, 0);
  }
}

export class RootTreeNode extends BaseTreeNode {
  parent: PathToRootNode | null;
  relationWithParent: GraphRelation | null;
  constructor({
    object,
    childrenGroups,
    path,
    depth,
    parent = null,
    relationWithParent = null,
    isExpanded = true,
  }: {
    object: GraphObject;
    childrenGroups: ChildrenGroups;
    parent?: PathToRootNode | null;
    relationWithParent?: GraphRelation | null;
    depth?: number;
    path?: string;
    isExpanded?: boolean;
  }) {
    super({ object, path, depth, childrenGroups, isExpanded });
    this.parent = parent;
    this.relationWithParent = relationWithParent;
  }

  get isBackrelation(): boolean {
    return this.relationWithParent?.from.id === this.object.id;
  }
}

export class DescendantTreeNode extends BaseTreeNode {
  parent: RootTreeNode | DescendantTreeNode;
  relationWithParent: GraphRelation;
  position: Position;
  instanceCountInPath: number;
  parentGroup: Group;
  isSearchMatch: boolean;
  searchMatchInDescendants: boolean;
  constructor({
    object,
    parent,
    position,
    relationWithParent,
    group,
    childrenGroups,
    instanceCountInPath,
    path,
    depth,
    isSearchMatch = false,
    searchMatchInDescendants = false,
    isExpanded = false,
  }: {
    object: DescendantTreeNode["object"];
    parent: DescendantTreeNode["parent"];
    position: DescendantTreeNode["position"];
    relationWithParent: GraphRelation;
    group: Group;
    childrenGroups: ChildrenGroups;
    instanceCountInPath: number;
    path: string;
    depth: number;
    isSearchMatch?: boolean;
    searchMatchInDescendants?: boolean;
    isExpanded?: boolean;
  }) {
    super({ object, path, depth, childrenGroups, isExpanded });
    this.parent = parent;
    this.instanceCountInPath = instanceCountInPath;
    this.parentGroup = group;
    this.isSearchMatch = isSearchMatch;
    this.searchMatchInDescendants = searchMatchInDescendants;
    this.relationWithParent = relationWithParent;
    this.position = position;
  }

  get siblingAbove(): DescendantTreeNode | null {
    const i = this.parentGroup.nodes.indexOf(this);
    if (i < 0) {
      throw new Error("Node not found in group");
    } else if (i === 0) {
      // get last node in previous group
      const prevGroup = this.parent.childrenGroups[i - 1];
      return prevGroup?.nodes[prevGroup.nodes.length - 1] || null;
    } else {
      return this.parentGroup.nodes[i - 1] || null;
    }
  }

  get siblingBelow(): DescendantTreeNode | null {
    const i = this.parentGroup.nodes.indexOf(this);
    if (i < 0) {
      throw new Error("Node not found in group");
    } else if (i === this.parentGroup.nodes.length - 1) {
      // get first node in next group
      const nextGroup = this.parent.childrenGroups[i + 1];
      return nextGroup?.nodes[0] || null;
    } else {
      return this.parentGroup.nodes[i + 1] || null;
    }
  }

  get isBackrelation(): boolean {
    return this.parent.object.id === this.relationWithParent.to.id;
  }
}

export type TreeNode = RootTreeNode | DescendantTreeNode;

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
    graphStore: GraphStore,
    settingsStore: SettingsStore,
    root: GraphObject | GraphRelation[],
    {
      search = "",
      filter = {},
      expansions = new Map(),
    }: {
      search?: string;
      filter?: Partial<Filter>;
      expansions?: Map<string, boolean>;
    } = {},
  ) {
    this.graphStore = graphStore;
    this.settingsStore = settingsStore;
    if (Array.isArray(root)) {
      this.rootObject = relationsPathToParentChild(root).slice(-1)[0]?.child;
      this.pathToRoot = root;
    } else {
      this.rootObject = root;
      this.pathToRoot = [];
    }
    this.search = search;
    this.partialFilter = filter;
    this.expansions = expansions;
    makeObservable(this, {
      rootObject: observable,
      pathToRoot: observable,
      setRoot: action,
      expansions: observable,
      rootTreeNode: computed,
      search: observable,
      setSearch: action,
      setPathExpanded: action,
      togglePathExpanded: action,
      setGroupExpanded: action,
      toggleGroupExpanded: action,
    });
  }

  private graphStore: GraphStore;
  private settingsStore: SettingsStore;

  /**
   * Set the root of the tree. You can either pass be a single object
   * or a contigous path of relations. In the latter case, whatever
   * object is at the end of the path will be considered the "root",
   * and the path will be shown as breadcrumbs above in the UI.
   */
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
  /** The root object of the tree. */
  public rootObject: GraphObject;
  /** Connected path of relations leading to the root object. */
  public pathToRoot: GraphRelation[] = [];

  /**
   * Expanded paths in the tree.
   *
   * @example
   * { "noGrouping": {"/root/1": true }, "groupByPinned": {"/root/pinned/1": false, "/root/all/1": true } }
   */
  public expansions: Map<string, boolean>;
  // For objects, we default to collapsed.
  isPathExpanded(path: Path): boolean {
    return this.expansions.get(path) || false;
  }
  setPathExpanded(path: Path, isExpanded: boolean) {
    this.expansions.set(path, isExpanded);
  }
  togglePathExpanded(path: Path) {
    this.expansions.set(path, !this.expansions.get(path));
  }

  // For groups, we default to expanded.
  isGroupExpanded(group: Group) {
    return this.expansions.get(group.path) ?? true;
  }
  setGroupExpanded(group: Group, isExpanded: boolean) {
    this.expansions.set(group.path, isExpanded);
  }
  toggleGroupExpanded(group: Group) {
    this.expansions.set(group.path, !this.isGroupExpanded(group));
  }

  // filter and search
  public search: string = "";
  setSearch(search: string) {
    logger.debug(`Setting search to "${search}"`);
    if (this.cache.cacheLastUpdated === 0 || this.cache.cacheLastUpdated !== this.cache.textsLastUpdated) {
      logger.debug("Text cache is outdated. Updating...", {
        cacheLastUpdated: this.cache.cacheLastUpdated,
        textsLastUpdated: this.cache.textsLastUpdated,
      });
      this.cache.cacheLastUpdated = this.cache.textsLastUpdated;
      const root = this.rootTreeNode;
      const visited = new Set<string>();
      const walk = (node: TreeNode) => {
        if (!visited.has(node.object.id)) {
          this.cache.texts.set(node.object.id, node.object.text.toLocaleLowerCase());
        }
        node.childrenGroups.forEach((group) => {
          group.nodes.forEach((child) => walk(child));
        });
      };
      walk(root);
    }
    this.search = search;
  }
  readonly partialFilter: Partial<Filter> = observable.object({}); // TODO the way I'm defining observerable is weird
  updateFilter(filter: Partial<Filter>) {
    Object.assign(this.partialFilter, filter);
  }

  /**
   * Returns an object representing the state of the tree.
   * TODO: add query
   */
  get rootTreeNode() {
    logger.debug("Creating tree");
    this.resetObjectTextWatchers();
    const rootTreeNode = new RootTreeNode({
      object: this.rootObject,
      childrenGroups: this.createChildrenGroups(""),
    });
    this.hydratePathToRoot(rootTreeNode);
    this.hydrateTreeNode(rootTreeNode);
    this.applyFilter(rootTreeNode);
    this.applySearch(rootTreeNode);
    this.applySort(rootTreeNode);
    return rootTreeNode;
  }

  /**
   * Hydrates the tree node with children and siblings recursively.
   */
  private hydrateTreeNode(parentNode: TreeNode, objectIdCountsInPath: { [key: string]: number } = {}) {
    parentNode.childrenGroups.forEach((group) => {
      const positionedRelations =
        group.id === "pinned"
          ? parentNode.object.pinnedRelationsWithPositions
          : parentNode.object.relationsWithPositions;
      group.path = parentNode.path + "/" + group.id;
      group.isExpanded = this.isGroupExpanded(group);
      group.nodes = positionedRelations.map((positionedRelation) => {
        const object = getOtherObject(positionedRelation.relation, parentNode.object.id);
        const instanceCountInPath = (objectIdCountsInPath[object.id] || 0) + 1;
        const path = group.path + "/" + positionedRelation.relation.id;
        const child = new DescendantTreeNode({
          object,
          parent: parentNode,
          position: positionedRelation.position,
          relationWithParent: positionedRelation.relation,
          group,
          instanceCountInPath,
          path,
          depth: parentNode.depth + 1,
          childrenGroups: this.createChildrenGroups(path),
          isExpanded: this.isPathExpanded(path),
        });
        if (parentNode.isExpanded && group.isExpanded) {
          // Only hydrate children if the parent is expanded. This is important, since we
          // allow circular references in the graph, and we don't want to infinitely recurse.
          this.hydrateTreeNode(child, {
            ...objectIdCountsInPath,
            [object.id]: instanceCountInPath,
          });
        }

        return child;
      });
    });
    this.watchObjectText(parentNode.object);
    return parentNode;
  }

  private hydratePathToRoot(root: RootTreeNode) {
    // walk up the path of relations above the root and hydrate with nodes
    let topPathNode: PathToRootNode | null = null;
    let prevNode: PathToRootNode | RootTreeNode = root;
    for (let i = this.pathToRoot.length - 1; i >= 0; i--) {
      const relation = this.pathToRoot[i];
      const nextNode: PathToRootNode = new PathToRootNode({
        object: getOtherObject(relation, prevNode.object.id),
        relationToChild: relation,
        child: prevNode,
      });
      prevNode.parent = nextNode;
      prevNode = nextNode;
    }
    topPathNode = prevNode instanceof PathToRootNode ? prevNode : null;
    if (topPathNode) {
      // then walk back down updating relevant fields
      let node = topPathNode;
      while (node.child instanceof PathToRootNode) {
        node.child.path = node.path + "/" + node.relationToChild.id;
        node.child.depth = node.depth + 1;
        node = node.child;
      }
      // and finally update the root node
      root.path = node.path + "/" + node.relationToChild.id;
      root.depth = node.depth + 1;
      root.relationWithParent = node.relationToChild;
      root.childrenGroups = this.createChildrenGroups(root.path);
    }
    return root;
  }

  private applyFilter(treeNode: TreeNode): boolean {
    function walk(treeNode: TreeNode, filter: Filter) {
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => walk(child, filter));
      });
      if (treeNode instanceof RootTreeNode) {
        return true;
      }
      if (filter.hideBackrelations && treeNode.isBackrelation) {
        return false;
      }
      if (filter.hideBundles && treeNode.object instanceof GraphNode && treeNode.object.isBundle) {
        return false;
      }
      /** Parent from the perspective of the graph, not the current tree */
      const isGraphParent =
        treeNode.isBackrelation && treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id;
      const grandparent = treeNode.parent.parent;
      if (filter.hideAllParents && isGraphParent) {
        return false;
      } else if (filter.hideAllRootParents && isGraphParent && treeNode.object.isRoot) {
        return false;
      } else if (filter.hideDirectParent && treeNode.object.id === grandparent?.object.id) {
        return false;
      }
      return true;
    }
    return walk(treeNode, this.filter);
  }

  private applySearch(treeNode: TreeNode) {
    if (!this.search) return;
    logger.debug("Applying search:", `"${this.search}"`);
    const search = this.search;
    const texts = this.cache.texts;
    function walk(treeNode: TreeNode) {
      let searchMatchInDescendants = false;
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => {
          walk(child);
          const match = child.isSearchMatch || child.searchMatchInDescendants;
          searchMatchInDescendants = searchMatchInDescendants || match;
          return match;
        });
      });
      if (treeNode instanceof DescendantTreeNode) {
        treeNode.isSearchMatch = search ? texts.get(treeNode.object.id)?.includes(search) ?? true : true;
        treeNode.searchMatchInDescendants = searchMatchInDescendants;
      }
    }
    walk(treeNode);
  }

  private applySort(treeNode: TreeNode) {
    function walk(treeNode: TreeNode) {
      treeNode.childrenGroups.forEach((group) => {
        group.nodes.sort((a, b) => comparePositions(a.position, b.position));
        group.nodes.forEach((child) => walk(child));
      });
    }
    walk(treeNode);
  }

  get filter(): Filter {
    return {
      hideBackrelations: this.settingsStore.hideBackrelations,
      hideBundles: this.settingsStore.hideBundles,
      hideAllParents: this.settingsStore.hideAllParents,
      hideAllRootParents: this.settingsStore.hideAllRootParents,
      hideDirectParent: this.settingsStore.hideDirectParent,
      ...this.partialFilter,
    };
  }

  private createChildrenGroups(parentPath: string): ChildrenGroups {
    const groups: ChildrenGroups = [
      { id: "pinned", path: "", nodes: [], isExpanded: true },
      { id: "all", path: "", nodes: [], isExpanded: true },
    ];
    groups.forEach((group) => {
      group.path = parentPath + "/" + group.id;
      group.isExpanded = this.isGroupExpanded(group);
    });
    return groups;
  }

  // Cache of object texts which we only update when the search input changes
  // (but *before* the search filter is applied to the tree). We reference these
  // texts when filtering the tree to avoid re-computing the tree every time the
  // real object text changes.
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

  async createChildNode() {
    const path = relationsPathToParentChild(this.pathToRoot);
    const root = path[path.length - 1].child;
    const { node, relation } = await this.graphStore.addChildNode({ parentId: root.id });
    return { node, relation, path: [...this.pathToRoot, relation] };
  }

  /**
   * Move the node to the sibling above.
   * @returns The new path of the node after the move
   */
  indentNode(treeNode: DescendantTreeNode): string | undefined {
    const siblingAbove = treeNode.siblingAbove;
    if (!siblingAbove) {
      return;
    }
    // Change the relation's parent to the sibling above
    if (!treeNode.isBackrelation) {
      this.graphStore.updateRelationFrom(treeNode.relationWithParent, siblingAbove.object);
    } else {
      this.graphStore.updateRelationTo(treeNode.relationWithParent, siblingAbove.object);
    }
    // Position the relation at the bottom of the siblings list
    this.graphStore.getRelationList(siblingAbove.object).move([treeNode.relationWithParent], "bottom");
    // toggle open sibling
    this.setPathExpanded(siblingAbove.path, true);
    // return expected new path to tree node
    return siblingAbove.childrenGroupsById.all.path + "/" + treeNode.relationWithParent.id;
  }

  /**
   * Move the node to the parent.
   * @returns The new path of the node after the move
   */
  dedentNode(treeNode: DescendantTreeNode): string | undefined {
    const parent = treeNode.parent;
    if (parent instanceof RootTreeNode) {
      logger.debug("Can't shift tab because no visible parent to move to");
      return;
    }
    const grandparent = parent.parent;
    // Replace the relations pointer to the parent with the grandparent
    if (treeNode.isBackrelation) {
      this.graphStore.updateRelationTo(treeNode.relationWithParent, grandparent.object);
    } else {
      this.graphStore.updateRelationFrom(treeNode.relationWithParent, grandparent.object);
    }
    // Position the relation under the parent
    this.graphStore.getRelationList(grandparent.object).move([treeNode.relationWithParent], parent.relationWithParent);
    return parent.parentGroup.path + "/" + treeNode.relationWithParent.id;
  }

  clear(root: GraphRelation[]) {
    this.pathToRoot = root;
    this.expansions.clear();
  }

  serialize(): SerializedTree {
    throw new Error("Method not implemented.");
    // return {
    //   root: this.pathToRoot.map((r) => r.id).join("/"),
    //   pathData: Object.fromEntries(this.expansions.entries()),
    // };
  }

  /**
   * Returns true if the deserialization was successful.
   */
  deserializeInPlace(data: SerializedTree): boolean {
    throw new Error("Method not implemented.");
    // const pathData = new Map<Path, PathData>();
    // if (data.pathData) {
    //   for (const [key, value] of Object.entries(data.pathData)) {
    //     pathData.set(key, value);
    //   }
    // }
    // this.expansions = pathData;
    // const relations: GraphRelation[] = [];
    // for (const id of data.root.split("/")) {
    //   const relation = this.graphStore.relationsById.get(id);
    //   if (!relation) {
    //     this.pathToRoot = [this.graphStore.outlineRootRelationFromUserRoot];
    //     return false;
    //   }
    //   relations.push(relation);
    // }
    // this.pathToRoot = relations;
    // return true;
  }
}

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
  let treeNode = node;
  while (!(treeNode instanceof RootTreeNode)) {
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
