import { IReactionDisposer, action, computed, makeObservable, observable, reaction } from "mobx";

import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore, Path, defaultRelationTypes } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { getOtherObjectOrThrow, getOtherSideOrThrow } from "@/app/graph/utils";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { Position, comparePositions, relationsPathToParentChild, uuid } from "@/app/util";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "tree" });

// TODO Can define a type for this?
export type PinnedGroup = { id: "pinned"; path: string; nodes: DescendantTreeNode[]; isExpanded: boolean };
export type AllGroup = { id: "all"; path: string; nodes: DescendantTreeNode[]; isExpanded: boolean };
type ChildrenGroups = [PinnedGroup, AllGroup];
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
    childrenGroups?: ChildrenGroups;
    path?: string;
    depth?: number;
    isExpanded?: boolean;
  }) {
    this.id = path;
    this.object = object;
    this.path = path;
    this.depth = depth;
    this.childrenGroups = childrenGroups;
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
      const nextGroupIndex = this.parent.childrenGroups.indexOf(this.parentGroup) + 1;
      const nextGroup = this.parent.childrenGroups[nextGroupIndex];
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

type TreeSelection =
  | {
      type: "editor";
      treeNodeId: string;
      startPos?: number;
      endPos?: number;
    }
  | {
      type: "node";
      treeNodeIds: Set<string>;
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
    makeObservable(this, {
      rootObject: observable,
      pathToRoot: observable,
      setRoot: action,
      expansionsByPath: observable,
      state: computed,
      search: observable,
      setSearch: action,
      setPathExpanded: action,
      togglePathExpanded: action,
      setGroupExpanded: action,
      toggleGroupExpanded: action,
      selection: observable,
      setFocusedNode: action,
    });
  }

  readonly id: string;

  private graphStore: GraphStore;

  private settingsStore: SettingsStore;

  /** The current selection in the tree. This can be a node selection or an editor selection. */
  selection: TreeSelection | null;

  /** The root object of the tree. */
  public rootObject: GraphObject;

  /** Connected path of relations leading to the root object. */
  public pathToRoot: GraphRelation[] = [];

  public search: string = "";

  readonly partialFilter: Partial<Filter> = observable.object({}); // TODO the way I'm defining observerable is weird

  /** Expanded paths in the tree. */
  public expansionsByPath: Map<string, boolean>;

  /**
   * Cache of object texts which we only update when the search input changes
   * (but *before* the search filter is applied to the tree). We reference these
   * texts when filtering the tree to avoid re-computing the tree every time the
   * real object text changes.
   *
   * TODO: This may make more sense in the graph store. I'm guessing we'll want a
   * text cache for the graph store as well.
   */
  private cache = { cacheLastUpdated: 0, textsLastUpdated: 0, texts: new Map<string, string>() };

  private disposers: Map<string, IReactionDisposer> = new Map();

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
    return {
      root: rootTreeNode,
      descendantTreeNodesById: createDescendantTreeNodesById(rootTreeNode),
    };
  }

  /** Set the selection to the editor of the given node. */
  setFocusedNode(treeNodeId: string | null) {
    this.selection = treeNodeId ? { type: "editor", treeNodeId, startPos: 0, endPos: 0 } : null;
  }

  /** Returns true if the given node's editor is focused. */
  isNodeFocused(treeNodeId: string) {
    return this.selection?.type === "editor" && this.selection.treeNodeId === treeNodeId;
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
  isGroupExpanded(group: Group) {
    return this.expansionsByPath.get(group.path) ?? true;
  }

  setGroupExpanded(group: Group, isExpanded: boolean) {
    this.expansionsByPath.set(group.path, isExpanded);
  }

  toggleGroupExpanded(group: Group) {
    this.expansionsByPath.set(group.path, !this.isGroupExpanded(group));
  }

  setSearch(search: string) {
    logger.debug(`Setting search to "${search}"`);
    if (this.cache.cacheLastUpdated === 0 || this.cache.cacheLastUpdated !== this.cache.textsLastUpdated) {
      logger.debug("Text cache is outdated. Updating...", {
        cacheLastUpdated: this.cache.cacheLastUpdated,
        textsLastUpdated: this.cache.textsLastUpdated,
      });
      this.cache.cacheLastUpdated = this.cache.textsLastUpdated;
      const { root } = this.state;
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
      group.isExpanded = this.isGroupExpanded(group);
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
    this.watchObjectText(parentNode.object);
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
      root.childrenGroups = this.createChildrenGroups(root.path);
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

  async createChildNodeAndFocus() {
    const rootTreeNode = this.state.root;
    const { node, relation } = await this.graphStore.addChildNode({ parentId: rootTreeNode.object.id });
    const path = rootTreeNode.childrenGroupsById.all.path + "/" + relation.id;
    this.setFocusedNode(path);
    return { node, relation, path };
  }

  /**
   * Move the node to the sibling above.
   * @returns The new path of the node after the move
   */
  async indentNode(treeNode: DescendantTreeNode): Promise<string | undefined> {
    const siblingAbove = treeNode.siblingAbove;
    if (!siblingAbove) {
      return;
    }
    // Change the relation's parent to the sibling above
    await this.graphStore.replaceRelationLink({
      direction: getOtherSideOrThrow(treeNode.relationWithParent, treeNode.object.id),
      relationId: treeNode.relationWithParent.id,
      replaceWith: { type: "existing-node", id: siblingAbove.object.id },
    });
    // Position the relation at the bottom of the siblings list
    this.graphStore.getRelationList(siblingAbove.object).move([treeNode.relationWithParent], "bottom");
    // toggle open sibling
    this.setPathExpanded(siblingAbove.path, true);
    const path = siblingAbove.childrenGroupsById.all.path + "/" + treeNode.relationWithParent.id;
    // Maintain focus
    if (this.isNodeFocused(treeNode.path)) {
      this.setFocusedNode(path);
    }
    return path;
  }

  /**
   * Move the node to the parent.
   * @returns The new path of the node after the move
   */
  async dedentNode(treeNode: DescendantTreeNode): Promise<string | undefined> {
    const parent = treeNode.parent;
    if (parent instanceof RootTreeNode) {
      logger.debug("Can't shift tab because no visible parent to move to");
      return;
    }
    const grandparent = parent.parent;
    await this.graphStore.replaceRelationLink({
      direction: getOtherSideOrThrow(treeNode.relationWithParent, treeNode.object.id),
      relationId: treeNode.relationWithParent.id,
      replaceWith: { type: "existing-node", id: grandparent.object.id },
    });
    // Position the relation under the parent
    this.graphStore.getRelationList(grandparent.object).move([treeNode.relationWithParent], parent.relationWithParent);
    const path = parent.parentGroup.path + "/" + treeNode.relationWithParent.id;
    // Maintain focus
    if (this.isNodeFocused(treeNode.path)) {
      this.setFocusedNode(path);
    }
    return path;
  }

  /**
   * Splits a node and returns the newly created graph object, relation, and
   * expected path to it in the tree.
   *
   * If the selection was at the start of a non-empty node, insert a new blank
   * node just above the current node.
   *
   * If the current node is expanded, split it and place the new node as it's
   * first child.
   *
   * Otherwise, split the node at the selection and place the new node as the
   * next sibling.
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
      const newNode = await this.graphStore.addChildNode({
        parentId: treeNode.parent.object.id,
        after: treeNode.siblingAbove?.relationWithParent,
      });
      if (treeNode.parentGroup.id === "pinned") {
        treeNode.parent.object.pinChildRelation(newNode.relation, treeNode.siblingAbove?.relationWithParent);
      }
      result = { ...newNode, path: treeNode.parentGroup.path + "/" + newNode.relation.id };
    } else {
      treeNode.object.setContent(contentBeforeSelection);
      if (treeNode.isExpanded && treeNode.childCount > 0) {
        const newNode = await this.graphStore.addChildNode({
          parentId: treeNode.object.id,
          nodeProps: { content: contentAfterSelection },
        });
        result = { ...newNode, path: treeNode.childrenGroupsById.all.path + "/" + newNode.relation.id };
      } else {
        const newNode = await this.graphStore.addChildNode({
          parentId: treeNode.parent.object.id,
          nodeProps: { content: contentAfterSelection },
          after: treeNode.relationWithParent,
        });
        if (treeNode.parentGroup.id === "pinned") {
          treeNode.parent.object.pinChildRelation(newNode.relation, treeNode.relationWithParent);
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

  moveNodeWithSelectionUp(): boolean {
    const { descendantTreeNodesById } = this.state;
    if (this.selection?.type !== "editor") {
      // TODO: Implement moving selection up for node selection
      return false;
    }
    const treeNode = descendantTreeNodesById.get(this.selection.treeNodeId);
    if (!treeNode) {
      logger.error("Can't move up because node not found");
      return false;
    }
    return this.moveNodeUp(treeNode);
  }

  moveNodeWithSelectionDown(): boolean {
    const { descendantTreeNodesById } = this.state;
    if (this.selection?.type !== "editor") {
      // TODO: Implement moving selection up for node selection
      return false;
    }
    const treeNode = descendantTreeNodesById.get(this.selection.treeNodeId);
    if (!treeNode) {
      logger.error("Can't move up because node not found");
      return false;
    }
    return this.moveNodeDown(treeNode);
  }

  private moveNodeUp(treeNode: DescendantTreeNode): boolean {
    const siblingAbove = treeNode.siblingAbove;
    if (!siblingAbove) {
      logger.debug("No sibling above to move to");
      return false;
    }
    this.graphStore
      .getRelationList(treeNode.parent.object)
      .move([siblingAbove.relationWithParent], treeNode.relationWithParent);
    return true;
  }

  private moveNodeDown(treeNode: DescendantTreeNode): boolean {
    const siblingBelow = treeNode.siblingBelow;
    if (!siblingBelow) {
      logger.debug("No sibling below to move to");
      return false;
    }
    this.graphStore
      .getRelationList(treeNode.parent.object)
      .move([treeNode.relationWithParent], siblingBelow.relationWithParent);
    return true;
  }

  /**
   * Move selection from the current node to the next one up.
   */
  moveSelectionUp(): boolean {
    const { descendantTreeNodesById } = this.state;
    if (this.selection?.type !== "editor") {
      // TODO: Implement moving selection up for node selection
      return false;
    }
    const treeNode = descendantTreeNodesById.get(this.selection.treeNodeId);
    if (!treeNode) {
      logger.error("Can't move selection up because node not found", this.selection.treeNodeId);
      return false;
    }
    const next = getNextAbove(treeNode);
    if (!next) return false;
    this.setFocusedNode(next.path);
    return true;
  }

  /**
   * Move selection from the current node to the next one down.
   */
  moveSelectionDown(): boolean {
    const { descendantTreeNodesById } = this.state;
    if (this.selection?.type !== "editor") {
      // TODO: Implement moving selection up for node selection
      return false;
    }
    const treeNode = descendantTreeNodesById.get(this.selection.treeNodeId);
    if (!treeNode) {
      logger.error("Can't move selection down because node not found", this.selection.treeNodeId);
      return false;
    }
    const next = getNextBelow(treeNode);
    if (!next) return false;
    this.setFocusedNode(next.path);
    return true;
  }

  clear(root: GraphRelation[]) {
    this.pathToRoot = root;
    this.expansionsByPath.clear();
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
