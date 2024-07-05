import { IReactionDisposer, makeAutoObservable, reaction, toJS } from "mobx";

import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path, defaultRelationTypes } from "@/app/graph/GraphStore";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { getOtherObjectOrThrow, getOtherSideOrThrow } from "@/app/graph/utils";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { Position, comparePositions, relationsPathToParentChild, uuid } from "@/app/util";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "tree" });

/**
 * When you expand a node in the tree, it's children are shown in distinct
 * groups. For now, that's just "pinned" and "all", but you can imagine later
 * having "suggested" or "related" groups as well. Or even having supporting
 * groupby operations like "by type" or "by relation" (similar to Linear).
 */
type Group = PinnedGroup | AllGroup;
// TODO Can define a type for this?
export type PinnedGroup = {
  id: "pinned";
  parent: BaseTreeNode;
  path: string;
  nodes: DescendantTreeNode[];
  isExpanded: boolean;
};
export type AllGroup = {
  id: "all";
  parent: BaseTreeNode;
  path: string;
  nodes: DescendantTreeNode[];
  isExpanded: boolean;
};
type ChildrenGroups = [PinnedGroup, AllGroup];
type ChildrenGroupsOmitParent = [Omit<PinnedGroup, "parent">, Omit<AllGroup, "parent">];

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
  id: string;
  object: GraphObject;
  depth: number;
  path: string;
  childrenGroups: ChildrenGroups;
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
    childrenGroups?: ChildrenGroupsOmitParent;
    path?: string;
    depth?: number;
    isExpanded?: boolean;
  }) {
    this.id = path;
    this.object = object;
    this.path = path;
    this.depth = depth;
    this.childrenGroups = [
      { ...childrenGroups[0], parent: this },
      { ...childrenGroups[1], parent: this },
    ];
    this.isExpanded = isExpanded;
  }

  get childrenGroupsById() {
    return { pinned: this.childrenGroups[0], all: this.childrenGroups[1] };
  }

  /**
   * Count of children nodes across all groups. These children may be hidden if this
   * node is collapsed. To get the count of visible children, use `visibleChildren`.
   */
  get childCount(): number {
    return this.childrenGroups.reduce((acc, group) => acc + group.nodes.length, 0);
  }

  /**
   * Returns list of visible children nodes. If this node is collapsed, it will
   * return an empty list.
   */
  get visibleChildren(): DescendantTreeNode[] {
    return this.isExpanded
      ? this.childrenGroups.reduce((acc, group) => acc.concat(group.nodes), [] as DescendantTreeNode[])
      : [];
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
    childrenGroups: ChildrenGroupsOmitParent;
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
    childrenGroups: ChildrenGroupsOmitParent;
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
    const nodeIndex = this.parentGroup.nodes.indexOf(this);
    if (nodeIndex < 0) {
      throw new Error("Node not found in group");
    } else if (nodeIndex === 0) {
      // get last node in previous group
      const prevGroupIdx = this.parent.childrenGroups.indexOf(this.parentGroup) - 1;
      const prevGroup = this.parent.childrenGroups[prevGroupIdx];
      if (!prevGroup?.isExpanded) return null; // TODO sketch that we need to do this
      return prevGroup?.nodes[prevGroup.nodes.length - 1] || null;
    } else {
      return this.parentGroup.nodes[nodeIndex - 1] || null;
    }
  }

  get siblingAboveInSameGroup(): DescendantTreeNode | null {
    const node = this.siblingAbove;
    return node?.parentGroup === this.parentGroup ? node : null;
  }

  get siblingBelow(): DescendantTreeNode | null {
    const nodeIndex = this.parentGroup.nodes.indexOf(this);
    if (nodeIndex < 0) {
      throw new Error("Node not found in group");
    } else if (nodeIndex === this.parentGroup.nodes.length - 1) {
      // get first node in next group
      const nextGroupIndex = this.parent.childrenGroups.indexOf(this.parentGroup) + 1;
      const nextGroup = this.parent.childrenGroups[nextGroupIndex];
      if (!nextGroup?.isExpanded) return null; // TODO sketch that we need to do this
      return nextGroup?.nodes[0] || null;
    } else {
      return this.parentGroup.nodes[nodeIndex + 1] || null;
    }
  }

  get siblingBelowInSameGroup(): DescendantTreeNode | null {
    const node = this.siblingBelow;
    return node?.parentGroup === this.parentGroup ? node : null;
  }

  get isBackrelation(): boolean {
    return this.parent.object.id === this.relationWithParent.to.id;
  }
}

export type TreeNode = RootTreeNode | DescendantTreeNode;

type EditorSelection = {
  type: "editor";
  treeNodeId: string;
  startPos?: number;
  endPos?: number;
};
type NodeSelection = {
  type: "node";
  anchorNodeId: string;
  headNodeId: string;
};
/**
 * Tree selection. This can either be a single node whose editor is focused or a
 * range of nodes that are selected.
 *
 * If the selection is a range of nodes, the `anchor` and `head` nodes are the
 * subtrees where the selection starts and ends. A subtree refers to a node and
 * all it's descendants. So when a node is in the selection, all it's
 * descendants are also considered selected.
 *
 * The `anchor` and `head` must not be descendants of each other. This is
 * important to contraint to make maintaining the tree across moves easier. See
 * `Tree.moveNodesIntoGroup` and
 * `Tree.updateSubtreeExpansionAndSelectionPathState` for more details.
 *
 * The entire selection must be within the same parent group. Allowing selections
 * that e.g. span the pinned and all groups is tricky to implement and can lead
 * to some unintuitive behaviours even when done right. So for now, we're keeping
 * it simple.
 */
type TreeSelection = EditorSelection | NodeSelection;
/**
 * Tree selection with nodes resolved. See {@link TreeSelection} for more
 * details.
 */
type TreeSelectionWithNodes =
  | (EditorSelection & { treeNode: DescendantTreeNode })
  | (NodeSelection & {
      /** The subtree where the selection starts. */
      anchor: DescendantTreeNode;
      /** The subtree where the selection ends */
      head: DescendantTreeNode;
      /** The top-most subtree in the selection */
      top: DescendantTreeNode;
      /** The bottom-most subtree in the selection */
      bottom: DescendantTreeNode;
      /** All the nodes in the selection, including subtree descendants */
      nodes: DescendantTreeNode[];
      /** All the subtrees in the selection */
      subtreeRoots: DescendantTreeNode[];
    });

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
      id = uuid(),
      search = "",
      filter = {},
      expansions = new Map(),
      selection = null,
    }: {
      id?: string;
      search?: string;
      filter?: Partial<Filter>;
      expansions?: Map<string, boolean>;
      selection?: TreeSelection | null;
    } = {},
  ) {
    this.id = id;
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
    this.expansionsByPath = expansions;
    this.selection = selection;
    makeAutoObservable<Tree, "cache">(this, {
      cache: false,
    });
  }

  private id: string;
  private graphStore: GraphStore;

  private settingsStore: SettingsStore;

  /** The current selection in the tree. This can be a node selection or an editor selection. */
  selection: TreeSelection | null;

  /** The root object of the tree. */
  public rootObject: GraphObject;

  /** Connected path of relations leading to the root object. */
  public pathToRoot: GraphRelation[] = [];

  public search: string = "";

  readonly partialFilter: Partial<Filter> = {};

  /** Expanded paths in the tree. */
  public expansionsByPath: Map<string, boolean>;

  private textsCache = new TextCache();

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

  /**
   * Returns a computed tree state based on the latest graph and expansion
   * states. This method is memoized and will only recompute when it's
   * dependencies change.
   */
  get state() {
    logger.debug("Creating tree");
    const rootTreeNode = new RootTreeNode({
      object: this.rootObject,
      childrenGroups: this.createChildrenGroups(""),
    });
    this.hydratePathToRoot(rootTreeNode);
    this.hydrateTreeNode(rootTreeNode);
    this.textsCache.updateIfStale(rootTreeNode); // Important to update cache before applying filters
    this.applyFilter(rootTreeNode);
    this.applySearch(rootTreeNode);
    this.applySort(rootTreeNode);
    return {
      root: rootTreeNode,
      descendantTreeNodesById: createDescendantTreeNodesById(rootTreeNode),
    };
  }

  /**
   * Returns selection with referenced nodes resolved.
   */
  get selectionWithNodes(): TreeSelectionWithNodes | null {
    if (!this.selection) {
      return null;
    } else if (this.selection.type === "editor") {
      const node = this.state.descendantTreeNodesById.get(this.selection.treeNodeId);
      if (!node) {
        logger.warn("Selection node not found", this.selection.treeNodeId);
        return null;
      }
      return { ...this.selection, treeNode: node };
    } else {
      const state = this.state;
      logger.debug("Recomputing selected nodes", { selection: toJS(this.selection), state });
      const anchor = state.descendantTreeNodesById.get(this.selection.anchorNodeId);
      const head = state.descendantTreeNodesById.get(this.selection.headNodeId);
      if (!anchor || !head) {
        logger.warn("Selection anchor or head not found", {
          anchor,
          head,
          anchorId: this.selection.anchorNodeId,
          headId: this.selection.headNodeId,
        });
        return null;
      }
      // TODO find a way to do this without walking the tree twice
      let top: DescendantTreeNode | undefined;
      walkTree(this.state.root, (n) => {
        if (!top && n instanceof DescendantTreeNode && (n.id === anchor.id || n.id === head.id)) {
          top = n;
        }
      });
      if (!top) {
        logger.warn("Selection start not found in tree", { anchor, head });
        return null;
      }
      const bottom = top === anchor ? head : anchor;
      // walk from the top node to the bottom node, selecting all nodes along the way
      const subtreeRoots = getSubtreesBetween(top, bottom);
      const allNodes = subtreeRoots.flatMap((root) => {
        const nodes: DescendantTreeNode[] = [];
        walkTree(root, (n) => {
          if (n instanceof DescendantTreeNode) {
            nodes.push(n);
          }
        });
        return nodes;
      });
      return {
        ...this.selection,
        top,
        bottom,
        anchor,
        head,
        nodes: allNodes,
        subtreeRoots,
      };
    }
  }

  /** Set the selection to the editor of the given node. */
  setFocusedNode(treeNodeId: string | null) {
    this.selection = treeNodeId ? { type: "editor", treeNodeId, startPos: 0, endPos: 0 } : null;
  }

  /** Returns true if the given node's editor is focused. */
  isNodeFocused(treeNodeId: string) {
    return this.selection?.type === "editor" && this.selection.treeNodeId === treeNodeId;
  }

  isNodeSelected(treeNodeId: string) {
    return (
      this.selectionWithNodes?.type === "node" && this.selectionWithNodes.nodes.some((node) => node.id === treeNodeId)
    );
  }

  /**
   * Set the root of the tree.
   *
   * If an array of relations is given, it must be a contiguous path,
   * and the object at the end of the path will be considered the "root".
   */
  setRoot(root: GraphObject | DescendantTreeNode | GraphRelation[]) {
    logger.debug("Setting tree root", root);
    if (Array.isArray(root)) {
      const path = relationsPathToParentChild(root);
      this.rootObject = path[path.length - 1].child;
      this.pathToRoot = root;
    } else if (root instanceof DescendantTreeNode) {
      this.rootObject = root.object;
      this.pathToRoot = getAncestorsAsArray(root).map((node) => node.relationToChild);
    } else {
      this.rootObject = root;
      this.pathToRoot = [];
    }
  }

  // For objects, we default to collapsed.
  isPathExpanded(path: Path): boolean {
    return this.expansionsByPath.get(path) || false;
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    this.expansionsByPath.set(path, isExpanded);
  }

  togglePathExpanded(path: Path) {
    this.expansionsByPath.set(path, !this.expansionsByPath.get(path));
  }

  // For groups, we default to expanded.
  isGroupExpanded(path: Path) {
    return this.expansionsByPath.get(path) ?? true;
  }

  setGroupExpanded(path: Path, isExpanded: boolean) {
    this.expansionsByPath.set(path, isExpanded);
  }

  toggleGroupExpanded(path: Path) {
    this.expansionsByPath.set(path, !this.isGroupExpanded(path));
  }

  setSearch(search: string) {
    logger.debug(`Setting search to "${search}"`);
    this.search = search;
  }

  updateFilter(filter: Partial<Filter>) {
    Object.assign(this.partialFilter, filter);
  }

  /**
   * Hydrates the tree node with children and siblings recursively.
   *
   * TODO this method is too long and complicated. tell Taylor to refactor it.
   */
  private hydrateTreeNode(
    parentNode: TreeNode,
    objectIdCountsInPath: { [key: string]: number } = {},
    nodesById: Map<string, TreeNode> = new Map(),
  ) {
    nodesById.set(parentNode.path, parentNode);
    parentNode.childrenGroups.forEach((group) => {
      const positionedRelations =
        group.id === "pinned"
          ? parentNode.object.pinnedRelationsWithPositions
          : parentNode.object.relationsWithPositions;
      group.path = parentNode.path + "/" + group.id;
      group.isExpanded = this.isGroupExpanded(group.path);
      group.nodes = positionedRelations.map((positionedRelation) => {
        const object = getOtherObjectOrThrow(positionedRelation.relation, parentNode.object.id);
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
          this.hydrateTreeNode(
            child,
            {
              ...objectIdCountsInPath,
              [object.id]: instanceCountInPath,
            },
            nodesById,
          );
        }

        return child;
      });
    });
    return parentNode;
  }

  /**
   * Hydrates the path to the root node with nodes.
   *
   * TODO this method is too long and complicated. tell Taylor to refactor it.
   */
  private hydratePathToRoot(root: RootTreeNode) {
    // walk up the path of relations above the root and hydrate with nodes
    let topPathNode: PathToRootNode | null = null;
    let prevNode: PathToRootNode | RootTreeNode = root;
    for (let i = this.pathToRoot.length - 1; i >= 0; i--) {
      const relation = this.pathToRoot[i];
      const nextNode: PathToRootNode = new PathToRootNode({
        object: getOtherObjectOrThrow(relation, prevNode.object.id),
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
      node.path = "/" + this.id;
      while (node.child instanceof PathToRootNode) {
        node.child.path = node.path + "/" + node.relationToChild.id;
        node.child.depth = node.depth + 1;
        node = node.child;
      }
      // and finally update the root node
      root.path = node.path + "/" + node.relationToChild.id;
      root.depth = node.depth + 1;
      root.relationWithParent = node.relationToChild;
      root.childrenGroups = [
        { ...root.childrenGroups[0], parent: root, path: root.path + "/pinned" },
        { ...root.childrenGroups[1], parent: root, path: root.path + "/all" },
      ];
    } else {
      root.path = "/" + this.id;
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
    const texts = this.textsCache.texts;
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

  private createChildrenGroups(parentPath: string): ChildrenGroupsOmitParent {
    const groups: ChildrenGroupsOmitParent = [
      { id: "pinned", path: "", nodes: [], isExpanded: true },
      { id: "all", path: "", nodes: [], isExpanded: true },
    ];
    groups.forEach((group) => {
      group.path = parentPath + "/" + group.id;
      group.isExpanded = this.isGroupExpanded(group.path);
    });
    return groups;
  }

  async createChildNodeAndFocus() {
    const rootTreeNode = this.state.root;
    const { node, relation } = await this.graphStore.addChildNode({ parentId: rootTreeNode.object.id });
    const path = rootTreeNode.childrenGroupsById.all.path + "/" + relation.id;
    this.setFocusedNode(path);
    return { node, relation, path };
  }

  async deleteSelection() {
    const selection = this.selectionWithNodes;
    if (selection?.type === "node") {
      for (const treeNode of selection.nodes) {
        await this.graphStore.removeRelation({ relationId: treeNode.relationWithParent.id });
      }
      const node = getNextAbove(selection.top);
      if (node) {
        this.setFocusedNode(node.path);
      }
    }
  }

  indentSelection(): boolean {
    return this.dentSelection("indent");
  }

  dedentSelection(): boolean {
    return this.dentSelection("dedent");
  }

  /**
   * Indents or dedents the current selection.
   *
   * Indenting moves the selection to the bottom of the sibling above.
   * Dedenting moves the selection to the grandparent, just below the current parent (while
   * in the pinned section, it positions below the current parent in both sections)
   */
  private dentSelection(dir: "indent" | "dedent"): boolean {
    const selection = this.selectionWithNodes;
    if (selection === null) return false;
    const subtrees = selection.type === "editor" ? [selection.treeNode] : selection.subtreeRoots;
    // move each group of siblings together
    for (const subtreeSiblings of groupSiblings(subtrees)) {
      let targetGroup: Group;
      let after: Positioner<GraphRelation> | undefined;
      if (dir === "indent") {
        // target bottom of the sibling above
        const top = subtreeSiblings[0];
        // there must be a sibling above in the same group to indent
        if (top.parentGroup !== top?.siblingAbove?.parentGroup) continue; // can't indent the top nodes
        targetGroup = top.siblingAbove.childrenGroupsById.all;
        after = -1;
      } else {
        // target grandparent, just below the current parent
        const parent = subtreeSiblings[0].parent;
        if (parent instanceof RootTreeNode) continue; // can't dedent past the root
        targetGroup = parent.parentGroup;
        after = parent.relationWithParent;
      }
      this.moveNodesIntoGroup(subtreeSiblings, targetGroup, after);
      this.setPathExpanded(targetGroup.parent.path, true);
    }
    return true;
  }

  /**
   * Moves the nodes into the given group while maintaining any expanded or
   * selected states.
   *
   * Note: If any of the provided nodes are descendants of each other, the
   * expansions and selections may not be preserved correctly. See
   * {@link updateSubtreeExpansionAndSelectionPathState} for more details.
   */
  private moveNodesIntoGroup(treeNodes: DescendantTreeNode[], group: Group, after?: Positioner<GraphRelation>) {
    treeNodes.forEach((node) => {
      const newPath = group.path + "/" + node.relationWithParent.id;
      this.updateSubtreeExpansionAndSelectionPathState(node.path, newPath);
    });
    // Every group represents a set of objects related to a parent. So to move the nodes
    // into the group, we need to update their relations to target the group's parent.
    const newParent = group.parent;
    if (newParent !== treeNodes[0].parent) {
      for (const treeNode of treeNodes) {
        this.graphStore.updateRelationTarget(treeNode.relationWithParent, {
          [getOtherSideOrThrow(treeNode.relationWithParent, treeNode.object.id)]: newParent.object,
        });
      }
    }
    // and position in the specified location in the group
    this.graphStore.getRelationList(newParent.object).move(
      treeNodes.map((n) => n.relationWithParent),
      after,
    );
    if (group.id === "pinned") {
      // If it's the pinned group, we also need to pin and set position there.
      group.parent.object.pinChildRelation(
        treeNodes.map((n) => n.relationWithParent),
        after,
      );
    }
  }

  /**
   * Splits a node and returns the newly created graph object, relation, and
   * expected path to it in the tree.
   *
   *
   * @DesignNote We leave the responsibility of generating the content for the new
   * and existing nodes to the caller, as opposed to taking a position and
   * determining the split content here. This method is intended to be used
   * by the editor, and the editor may include rendered text which isn't part
   * of the node content. For example, the text of @ mentions aren't part of
   * the node's content, but if you place the caret in the middle of an @ mention
   * and split the node, you expect the mention text to get split accordingly.
   * So we let the editor determine the split content and pass it to this method.
   */
  async splitNode(
    treeNode: DescendantTreeNode,
    contentBeforeSelection: Chip[],
    contentAfterSelection: Chip[],
  ): Promise<{ node: GraphObject; relation: GraphRelation; path: string }> {
    let result: { node: GraphObject; relation: GraphRelation; path: string };
    if (!(treeNode.object instanceof GraphNode)) {
      throw new Error("Only splitting nodes is supported for now.");
    }
    if (contentBeforeSelection.length === 0 && contentAfterSelection.length > 0) {
      // If the selection was at the start of a non-empty node, insert a new blank
      // node just above the current node.
      const siblingAbove = treeNode.siblingAboveInSameGroup;
      if (treeNode.parentGroup.id === "pinned") {
        const newNode = await this.graphStore.addChildNode({
          parentId: treeNode.parent.object.id,
          after: -1,
        });
        treeNode.parent.object.pinChildRelation(newNode.relation, siblingAbove?.relationWithParent);
        result = { ...newNode, path: treeNode.parentGroup.path + "/" + newNode.relation.id };
      } else {
        const newNode = await this.graphStore.addChildNode({
          parentId: treeNode.parent.object.id,
          after: siblingAbove?.relationWithParent,
        });
        result = { ...newNode, path: treeNode.parentGroup.path + "/" + newNode.relation.id };
      }
    } else {
      treeNode.object.setContent(contentBeforeSelection);
      //  If the current node is expanded, split it and place the new node as it's
      //  first child.
      if (treeNode.isExpanded && treeNode.childCount > 0) {
        const newNode = await this.graphStore.addChildNode({
          parentId: treeNode.object.id,
          nodeProps: { content: contentAfterSelection },
        });
        result = { ...newNode, path: treeNode.childrenGroupsById.all.path + "/" + newNode.relation.id };
      } else {
        //  Split the node at the selection
        let newNode: { node: GraphObject; relation: GraphRelation };
        if (treeNode.parentGroup.id === "pinned") {
          // while in the pinned section, create a new node at the bottom, then pin it
          // just below the current node
          newNode = await this.graphStore.addChildNode({
            parentId: treeNode.parent.object.id,
            nodeProps: { content: contentAfterSelection },
            after: -1,
          });
          treeNode.parent.object.pinChildRelation(newNode.relation, treeNode.relationWithParent);
        } else {
          // while in the all section, create a new node just below the current node
          newNode = await this.graphStore.addChildNode({
            parentId: treeNode.parent.object.id,
            nodeProps: { content: contentAfterSelection },
            after: treeNode.relationWithParent,
          });
        }
        result = { ...newNode, path: treeNode.parentGroup.path + "/" + newNode.relation.id };
      }
    }
    // If the node was focused, focus the new node
    if (this.isNodeFocused(treeNode.path)) {
      this.setFocusedNode(result.path);
    }
    return result;
  }

  /**
   * Moves the selected or focused nodes up one step.
   */
  moveSelectedNodesUp(): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    // Get the nodes to move
    let subtreeRoots: DescendantTreeNode[];
    let top: DescendantTreeNode;
    if (selection.type === "node") {
      subtreeRoots = selection.subtreeRoots;
      top = selection.top;
    } else if (selection.type === "editor") {
      subtreeRoots = [selection.treeNode];
      top = selection.treeNode;
    } else {
      return selection satisfies never;
    }
    // don't allow moving nodes that belong to different groups
    if (subtreeRoots.some((n) => n.parentGroup !== top.parentGroup)) {
      return false;
    }
    if (top.siblingAboveInSameGroup) {
      // swap with sibling above in same group
      // TODO the group should know how to do this work
      const relationList =
        top.parentGroup.id === "pinned"
          ? this.graphStore.getPinnedRelationList(top.parent.object)
          : this.graphStore.getRelationList(top.parent.object);
      relationList.move(
        subtreeRoots.map((t) => t.relationWithParent),
        top.siblingAboveInSameGroup?.siblingAboveInSameGroup?.relationWithParent,
      );
      return true;
    } else if (top.siblingAbove) {
      // don't allow moving nodes into a different group
      return false;
    } else if (top.parent instanceof DescendantTreeNode && top.parent.siblingAbove) {
      // Move the nodes to the bottom of the sibling above the current parent
      const newGroup = top.parent.siblingAbove.childrenGroupsById.all;
      this.moveNodesIntoGroup(subtreeRoots, newGroup, -1);
      this.setPathExpanded(newGroup.parent.path, true);
      return true;
    }
    console.log(toJS(this.selection));
    return false;
  }

  /**
   * Moves the selected or focused nodes down one step.
   */
  moveSelectedNodesDown(): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    // Get the nodes to move
    let subtreeRoots: DescendantTreeNode[];
    let bottom: DescendantTreeNode;
    if (selection.type === "node") {
      subtreeRoots = selection.subtreeRoots;
      bottom = selection.bottom;
    } else if (selection.type === "editor") {
      subtreeRoots = [selection.treeNode];
      bottom = selection.treeNode;
    } else {
      return selection satisfies never;
    }
    // don't allow moving nodes that belong to different groups
    if (subtreeRoots.some((n) => n.parentGroup !== bottom.parentGroup)) {
      return false;
    }
    if (bottom.siblingBelowInSameGroup) {
      // swap with sibling below in same group
      // TODO the group should know how to do this work
      const relationList =
        bottom.parentGroup.id === "pinned"
          ? this.graphStore.getPinnedRelationList(bottom.parent.object)
          : this.graphStore.getRelationList(bottom.parent.object);
      relationList.move(
        subtreeRoots.map((t) => t.relationWithParent),
        bottom.siblingBelowInSameGroup.relationWithParent,
      );
      return true;
    } else if (bottom.siblingBelow) {
      // don't allow moving nodes into a different group
      return false;
    } else if (bottom.parent instanceof DescendantTreeNode && bottom.parent.siblingBelow) {
      // Move the nodes to the bottom of the sibling below the current parent
      const newGroup = bottom.parent.siblingBelow.childrenGroupsById.all;
      this.moveNodesIntoGroup(subtreeRoots, newGroup, 0);
      this.setPathExpanded(newGroup.parent.path, true);
      return true;
    }
    return false;
  }

  /**
   * Moves the head of the node selection up. If it's currently
   * an editor selection, it will convert it to a node selection.
   */
  moveNodeSelectionHeadUp(): boolean {
    return this.moveNodeSelectionHead("up");
  }

  /**
   * Moves the head of the node selection down. If it's currently
   * an editor selection, it will convert it to a node selection.
   */
  moveNodeSelectionHeadDown(): boolean {
    return this.moveNodeSelectionHead("down");
  }

  // TODO: feels like this could be simplified
  private moveNodeSelectionHead(dir: "up" | "down"): boolean {
    const selection = this.selectionWithNodes;
    if (selection?.type === "editor") {
      // convert editor selection to node selection
      const head = selection.treeNode;
      this.selection = { type: "node", anchorNodeId: head.id, headNodeId: head.id };
      return true;
    } else if (selection?.type === "node") {
      // Get the next node in the given direction from the head. This is either
      // the next node directly aboven/below the head or if that's already
      // selected then sibling above/below the head
      const { anchor, head } = selection;
      let newHead: DescendantTreeNode | null = null;
      let newAnchor: DescendantTreeNode | null = null;
      if (dir === "up") {
        newHead = getNextAbove(head) ?? null;
        newHead = newHead && this.isNodeSelected(newHead.path) ? head.siblingAbove : newHead;
        if (newHead && newHead.parentGroup.id !== anchor.parentGroup.id) {
          // If the new head is in a different group, move up to the parent group
          newHead = newHead.parent instanceof DescendantTreeNode ? newHead.parent : null;
        }
        if (newHead && anchor.path.startsWith(newHead.path)) {
          newAnchor = newHead;
        }
      } else {
        newHead = getNextBelow(head) ?? null;
        newHead = newHead && this.isNodeSelected(newHead.path) ? head.siblingBelow : newHead;
        if (newHead && newHead.parentGroup.id !== anchor.parentGroup.id) {
          // don't allow moving down into a different group
          return false;
        }
      }
      if (this.selection?.type !== "node") {
        logger.warn(`Expected node selection type "node" but seeing "${this.selection?.type}"`);
        return false;
      }
      if (newHead) {
        this.selection.headNodeId = newHead.path;
      }
      if (newAnchor) {
        this.selection.anchorNodeId = newAnchor.path;
      }
      return true;
    }
    return false;
  }

  /**
   * Move selection from the current node to the next one up.
   */
  moveEditorSelectionUp(): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const treeNode = selection.type === "editor" ? selection.treeNode : selection.top;
    const next = getNextAbove(treeNode);
    if (!next) return false;
    this.setFocusedNode(next.path);
    return true;
  }

  /**
   * Move selection from the current node to the next one down.
   */
  moveEditorSelectionDown(): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const next = selection.type === "editor" ? getNextBelow(selection.treeNode) : getNextSubtreeBelow(selection.bottom);
    if (!next) return false;
    this.setFocusedNode(next.path);
    return true;
  }

  /**
   * Convert a node selection to an editor selection or and editor selection to
   * no selection.
   */
  escapeSelection() {
    if (this.selection === null) {
      return;
    } else if (this.selection?.type === "editor") {
      this.selection = null;
    } else {
      this.setFocusedNode(this.selection.headNodeId);
    }
  }

  /**
   * When you move a tree node to a new position, it's path will be different on
   * the next render. If the node or any of it's descendants were expanded or
   * selected, we want to keep it that way. These states are stored by path so we
   * need to move them to the new path.
   *
   * @DesignNote If you try to separately indent a node and one of it's deeply
   * nested descendants, and hope this method can adjust both paths, you're
   * gonna have a bad time. While moving multiple nodes, you only have access to
   * stale path values. If you indent a node and a deeply nested, you would need
   * to consider where the ancestor moved to in order to update the descendant's
   * path correctly. We could imagine a more complicated design where we keep
   * around our path mappings and then map descendants through all of them, but
   * that seems like overkill for now. Avoiding that situation is why we only
   * support selecting and indenting entire subtrees right now.
   */
  private updateSubtreeExpansionAndSelectionPathState(path: Path, newPath: Path) {
    if (path === newPath) return;
    const pathAndDescendants = Array.from(this.expansionsByPath.keys()).filter((p) => p.startsWith(path));
    for (const p of pathAndDescendants) {
      const state = this.expansionsByPath.get(p);
      if (state !== undefined) {
        this.expansionsByPath.set(p.replace(path, newPath), state);
        this.expansionsByPath.delete(p);
      }
    }
    if (this.selection?.type === "node") {
      if (this.selection.anchorNodeId === path) {
        this.selection.anchorNodeId = newPath;
      }
      if (this.selection.headNodeId === path) {
        this.selection.headNodeId = newPath;
      }
    } else if (this.selection?.type === "editor" && this.selection.treeNodeId === path) {
      this.selection.treeNodeId = newPath;
    }
  }

  clear(root: GraphRelation[]) {
    this.pathToRoot = root;
    this.expansionsByPath.clear();
    this.textsCache.clear();
  }

  serialize(): SerializedTree {
    return {
      id: this.id,
      pathToRootIds: this.pathToRoot.map((r) => r.id),
      rootObjectId: this.rootObject.id,
      expansionsByPath: Object.fromEntries(this.expansionsByPath.entries()),
    };
  }

  /**
   * Returns true if the deserialization was successful.
   */
  deserializeInPlace(data: SerializedTree): boolean {
    const expansionsByPath = new Map<string, boolean>();
    Object.entries(data.expansionsByPath ?? {}).forEach(([key, value]) => expansionsByPath.set(key, value));
    let pathToRoot: GraphRelation[] = [];
    for (const id of data.pathToRootIds) {
      const relation = this.graphStore.relationsById.get(id);
      if (!relation) {
        return false;
      }
      pathToRoot.push(relation);
    }
    const rootObject = this.graphStore.getObject(data.rootObjectId);
    if (!rootObject) {
      return false;
    }
    this.id = data.id;
    this.pathToRoot = pathToRoot;
    this.rootObject = rootObject;
    this.expansionsByPath = expansionsByPath;
    return true;
  }
}

/**
 * Cache of object texts for tree search filtering.
 *
 * When computing the tree state, if there's a search input, we need
 * to filter out nodes that don't match the search. But if we reference the
 * object texts directly, mobx will recompute the tree every time the object
 * text changes, which we don't want. So we cache the object texts and reference
 * the cache during the search filter. When any object text changes, we mark the
 * cache as stale and recompute it before applying the next search filter.
 *
 * TODO: This may make more sense in the graph store. I'm guessing we'll want a
 * text cache for the graph store as well.
 */
class TextCache {
  texts = new Map<string, string>();
  disposers = new Map<string, IReactionDisposer>();
  isStale = true;

  updateIfStale(root: RootTreeNode) {
    if (!this.isStale) return;
    logger.debug("Text cache is outdated. Updating...");
    this.clear();
    walkTree(root, (node) => {
      // cache current texts
      if (!this.texts.has(node.object.id)) {
        this.texts.set(node.object.id, node.object.text.toLocaleLowerCase());
      }
      // mark as stale if any text changes
      if (!this.disposers.has(node.object.id)) {
        const disposer = reaction(
          () => node.object.text,
          () => {
            this.isStale = true;
            this.disposers.clear();
            logger.debug("Text cache is now stale");
          },
        );
        this.disposers.set(node.object.id, disposer);
      }
    });
    this.isStale = false;
  }

  clear() {
    this.texts.clear();
    this.disposers.forEach((disposer) => disposer());
    this.disposers.clear();
    this.isStale = true;
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
export const isUnlabelledChild = (node: DescendantTreeNode) => {
  return node.relationWithParent.relationType.id === "child" && !node.isBackrelation;
};

/**
 * When the tree is rendered as an outline, this function returns the node
 * rendered directly above the given node.
 */
function getNextAbove(treeNode: TreeNode): DescendantTreeNode | undefined {
  if (treeNode instanceof RootTreeNode) {
    return;
  }
  if (treeNode.siblingAbove) {
    // get last descendant of sibling above
    let current = treeNode.siblingAbove;
    let next = current;
    while (next) {
      current = next;
      const children = current.visibleChildren;
      next = children[children.length - 1];
    }
    return current;
  } else if (treeNode.parent instanceof DescendantTreeNode) {
    return treeNode.parent;
  }
}

/**
 * When the tree is rendered as an outline, this function returns the node
 * rendered directly below the given node.
 */
function getNextBelow(treeNode: TreeNode): DescendantTreeNode | undefined {
  const firstChild = treeNode.visibleChildren[0];
  if (firstChild) {
    return firstChild;
  } else if (treeNode instanceof RootTreeNode) {
    return;
  } else {
    if (treeNode.siblingBelow) {
      return treeNode.siblingBelow;
    } else {
      // get sibling below of nearest ancestor
      let current = treeNode;
      while (current.parent instanceof DescendantTreeNode) {
        if (current.parent.siblingBelow) {
          return current.parent.siblingBelow;
        }
        current = current.parent;
      }
      return;
    }
  }
}

function createDescendantTreeNodesById(root: TreeNode) {
  const nodesById = new Map<string, DescendantTreeNode>();
  const stack: TreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node instanceof DescendantTreeNode) {
      nodesById.set(node.path, node);
    }
    node.childrenGroups.forEach((group) => {
      group.nodes.forEach((child) => stack.push(child));
    });
  }
  return nodesById;
}

function groupSiblings(treeNodes: DescendantTreeNode[]): DescendantTreeNode[][] {
  const siblingGroups = new Map<string, DescendantTreeNode[]>();
  treeNodes.forEach((node) => {
    const group = siblingGroups.get(node.parentGroup.path);
    if (group) {
      group.push(node);
    } else {
      siblingGroups.set(node.parentGroup.path, [node]);
    }
  });
  return Array.from(siblingGroups.values());
}

/**
 * Get the next subtree below. Like {@link getNextBelow} but it skips
 * the given nodes descendants.
 */
function getNextSubtreeBelow(treeNode: DescendantTreeNode): DescendantTreeNode | null {
  return treeNode.siblingBelow || (treeNode.parent instanceof DescendantTreeNode ? treeNode.parent.siblingBelow : null);
}

/**
 * Walks the tree from top to bottom, returning the nodes in order
 * excluding their descendants.
 */
function getSubtreesBetween(top: DescendantTreeNode, bottom: DescendantTreeNode) {
  const subtrees: DescendantTreeNode[] = [];
  let next: DescendantTreeNode | null = top;
  while (next && next !== bottom) {
    subtrees.push(next);
    next = getNextSubtreeBelow(next);
  }
  subtrees.push(bottom);
  return subtrees;
}

/**
 * Executes a callback on each node in the tree, starting with the given node.
 * If the callback returns false, the walk won't descend that node.
 */
function walkTree(treeNode: TreeNode, callback: (node: TreeNode) => boolean | void) {
  const res = callback(treeNode);
  if (res === false) return;
  treeNode.visibleChildren.forEach((child) => walkTree(child, callback));
}
