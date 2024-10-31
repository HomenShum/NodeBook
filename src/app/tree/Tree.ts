import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";
import { SetStateAction } from "react";

import { defaultRelationTypes } from "@/app/graph/constants";
import { Chip, GraphNode, GraphNodeProps } from "@/app/graph/GraphNode";
import { GraphObject, isGraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { Positioner, TxCombined } from "@/app/graph/GraphTransactionTypes";
import { PlaceholderGraphObject } from "@/app/graph/PlaceholderGraphObject";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { extractGroupId, extractPointedAtObjectId, getSideOrThrow } from "@/app/graph/utils";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { ExpansionLocalStorageCache } from "@/app/tree/ExpansionLocalStorageCache";
import { SelectionStack } from "@/app/tree/SelectionStack";
import { SortOptionLocalStorageCache } from "@/app/tree/SortOptionLocalStorageCache";
import { comparePositions, compareTimestamps, ObjectPath, uuid } from "@/app/util";
import appLogger from "@/lib/logger";

import { BaseTreeNode, DescendantTreeNode, PathToRootNode, PointerTreeNode, RootTreeNode, TreeNode } from "./nodes";
import { TreeNodeContentSelectionPosition, TreeSelection, TreeSelectionWithNodes } from "./selection";
import {
  createDescendantTreeNodesById,
  createPath,
  getAncestorsAsArray,
  getNextAbove,
  getNextBelow,
  getNextSubtreeBelow,
  getSubtreesBetween,
  groupSiblings,
  isNoteContent,
  walkTree,
} from "./utils";

/**
 * Forward slash delimited relation ids.
 * Needs to be relation ids, not node ids, cause you can have multiple instances of
 * the same node related to the same parent, so node paths are not unique.
 *
 * Example:
 * - A
 *   - child: B
 *   - author: B
 */
export type Path = string;

export type Root = DescendantTreeNode | ObjectPath | GraphObject;

export type SortOption = {
  mode: "createdAt" | "updatedAt" | "manual";
  direction: "asc" | "desc";
};

const logger = appLogger.child({ service: "tree" });

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
    root: DescendantTreeNode | ObjectPath | GraphObject,
    {
      id = uuid(),
      search = "",
      filter = {},
      expansions = new Map(),
      selection = null,
      sortOption = {
        mode: "manual",
        direction: "desc",
      },
      path = "",
    }: {
      id?: string;
      search?: string;
      filter?: Partial<Filter>;
      expansions?: Map<string, boolean>;
      selection?: TreeSelection | null;
      sortOption?: SortOption;
      path?: string;
    } = {},
  ) {
    this.id = id;
    this.graphStore = graphStore;
    this.settingsStore = settingsStore;
    const { rootObjectId, pathToRootIds } = this.setRoot(root, path);
    this.rootObjectId = rootObjectId;
    this.pathToRootIds = pathToRootIds;
    this.search = search;
    this.partialFilter = filter;
    this.sortOptionLocalStorageCache = new SortOptionLocalStorageCache();
    this.sortOption = this.sortOptionLocalStorageCache.load() ?? sortOption;
    this.expansionLocalStorageCache = new ExpansionLocalStorageCache();
    this.expansionsByPath = expansions.size === 0 ? this.expansionLocalStorageCache.load() : expansions;
    this.selection = selection;
    this.path = path;
    this.selectionStack = new SelectionStack();
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable<this, "partialFilter" | "sortOption">(this, {
      selection: observable,
      rootObjectId: observable,
      rootObject: computed,
      pathToRootIds: observable.shallow,
      pathToRoot: computed,
      search: observable,
      sortOption: observable,
      expansionsByPath: observable,
      partialFilter: observable,
      path: observable,
      filter: computed,
      updateFilter: action,
      state: computed,
      root: computed,
      selectionWithNodes: computed,
      setFocusedNode: action,
      selectBetween: action,
      setRoot: action,
      setPathExpanded: action,
      togglePathExpanded: action,
      setGroupExpanded: action,
      toggleGroupExpanded: action,
      setSearch: action,
      createChildOfRootAndFocus: action,
      createChildNode: action,
      deleteSelection: action,
      indentSelection: action,
      dedentSelection: action,
      split: action,
      moveSelectedNodesUp: action,
      moveSelectedNodesDown: action,
      moveNodeSelectionHeadUp: action,
      moveNodeSelectionHeadDown: action,
      moveEditorSelectionUp: action,
      moveEditorSelectionDown: action,
      escapeSelection: action,
      updateSubtreeExpansionAndSelectionPathState: action,
      clear: action,
      deserializeInPlace: action,
      updateSortByOption: action,
    });
  }

  protected id: string;

  protected graphStore: GraphStore;

  protected settingsStore: SettingsStore;

  /** The current selection in the tree. This can be a node selection or an editor selection. */
  selection: TreeSelection | null;

  rootObjectId: string;

  /** The root object of the tree. */
  get rootObject(): GraphObject {
    const rootObject = this.graphStore.getObject(this.rootObjectId);
    return rootObject ?? new PlaceholderGraphObject(this.graphStore, this.rootObjectId, this.graphStore.user.id);
  }

  pathToRootIds: string[] = [];

  /** Connected path of relations leading to the root object. */
  public get pathToRoot(): (GraphRelation | undefined)[] {
    return this.pathToRootIds.map((id) => this.graphStore.getRelation(id));
  }

  public search: string = "";

  protected partialFilter: Partial<Filter> = {};

  public sortOption: SortOption = {
    mode: "manual",
    direction: "desc",
  };

  /** Helper class to read and sync sort option with local storage */
  protected sortOptionLocalStorageCache: SortOptionLocalStorageCache;

  /** Helper class to read and sync expansion state with local storage */
  protected expansionLocalStorageCache: ExpansionLocalStorageCache;

  /** Expanded paths in the tree. */
  public expansionsByPath: Map<string, boolean>;

  /** Connected path of relations and groups leading to the root object. */
  public path: string;

  private selectionStack: SelectionStack;
  /**
   * Cache of object texts for tree search filtering.
   *
   * When computing the tree state, if there's a search input, we need to filter
   * out nodes that don't match the search. But if we reference the object texts
   * directly, mobx will recompute the tree every time the object text changes,
   * which we don't want. So we cache the object texts in this *non-observable*
   * map and reference the cache during the search filter. It's important that
   * it not be observable!
   *
   * TODO: This may make more sense in the graph store. I'm guessing we'll want a
   * text cache for the graph store as well.
   */
  textsByObjectId = new Map<string, string>();

  /**
   * @DesignNote The settings store is used as the default filter, and any
   * filter props assigned to the tree will override the settings store.
   */
  get filter(): Filter {
    return {
      hideBackrelations: this.settingsStore.hideBackrelations,
      hideAllParents: this.settingsStore.hideAllParents,
      hideAllRootParents: this.settingsStore.hideAllRootParents,
      hideDirectParent: this.settingsStore.hideDirectParent,
      hidePinnedSection: false,
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
    const rootTreeNode = new RootTreeNode({ tree: this }).hydrate();
    this.applyFilter(rootTreeNode);
    this.applySearch(rootTreeNode);
    this.applySort(rootTreeNode);
    return {
      root: rootTreeNode,
      descendantTreeNodesById: createDescendantTreeNodesById(rootTreeNode),
    };
  }

  get root() {
    return this.state.root;
  }

  getNode(path: Path) {
    return this.state.descendantTreeNodesById.get(path);
  }

  getNodeOrThrow(path: Path) {
    const node = this.getNode(path);
    if (!node) {
      throw new Error(`Tree node at path not found: ${path}`);
    }
    return node;
  }

  /**
   * Returns selection with referenced nodes resolved.
   */
  get selectionWithNodes(): TreeSelectionWithNodes | null {
    if (!this.selection) return null;

    const { descendantTreeNodesById } = this.state;

    if (this.selection.type === "editor") {
      const node = descendantTreeNodesById.get(this.selection.treeNodeId);
      if (!node) {
        return null;
      }
      return { ...this.selection, treeNode: node, subtreeRoots: [node], top: node, bottom: node };
    }

    logger.debug("Recomputing selected nodes", { selection: toJS(this.selection), state: this.state });

    const anchor = descendantTreeNodesById.get(this.selection.anchorNodeId);
    const head = descendantTreeNodesById.get(this.selection.headNodeId);

    if (!anchor || !head) {
      logger.warn("Selection anchor or head not found", {
        anchor,
        head,
        anchorId: this.selection.anchorNodeId,
        headId: this.selection.headNodeId,
      });
      return null;
    }

    const top = this.findTopNode(anchor, head);
    if (!top) {
      logger.warn("Selection start not found in tree", { anchor, head });
      return null;
    }

    const bottom = top === anchor ? head : anchor;
    const subtreeRoots = getSubtreesBetween(top, bottom);
    const allNodes = this.collectSelectedNodes(subtreeRoots, anchor, head);

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

  private findTopNode(anchor: DescendantTreeNode, head: DescendantTreeNode): DescendantTreeNode | undefined {
    let top: DescendantTreeNode | undefined;
    walkTree(this.state.root, (n) => {
      if (!top && n instanceof DescendantTreeNode && (n.id === anchor.id || n.id === head.id)) {
        top = n;
      }
    });
    return top;
  }

  private collectSelectedNodes(
    subtreeRoots: DescendantTreeNode[],
    anchor: DescendantTreeNode,
    head: DescendantTreeNode,
  ): DescendantTreeNode[] {
    let foundAnchor = false;
    let foundHead = false;
    return subtreeRoots.flatMap((root) => {
      const nodes: DescendantTreeNode[] = [];
      walkTree(root, (n) => {
        if (n instanceof DescendantTreeNode) {
          const isAnchorOrHead = n.id === anchor.id || n.id === head.id;

          // Include all descendants of the bottom node's ancestors for consistency.
          const isInSelectionPath =
            n.isDescendantOf(head) || n.isDescendantOf(anchor) || nodes.some((node) => n.isDescendantOf(node));
          const shouldInclude = !foundAnchor || !foundHead || isAnchorOrHead || isInSelectionPath;

          if (isAnchorOrHead) {
            if (n.id === anchor.id) foundAnchor = true;
            if (n.id === head.id) foundHead = true;
          }

          if (shouldInclude) nodes.push(n);
        }
      });
      return nodes;
    });
  }

  /**
   * Sets the focused node in the editor.
   */
  setFocusedNode(treeNodeId: string | null, position: TreeNodeContentSelectionPosition = "end", editMode?: boolean) {
    this.selection = treeNodeId ? { type: "editor", treeNodeId, position, editMode } : null;
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

  selectBetween(anchorNodeId: string, headNodeId: string) {
    this.selection = { type: "node", anchorNodeId, headNodeId };
  }

  /**
   * Set the root of the tree.
   *
   * If an array of relations is given, it must be a contiguous path,
   * and the object at the end of the path will be considered the "root".
   */
  setRoot(root: Root, path: string) {
    logger.debug("Setting tree root", root);
    if (root instanceof DescendantTreeNode) {
      this.rootObjectId = root.object.id;
      this.pathToRootIds = getAncestorsAsArray(root).map((node) => node.relationToChild.id);
    } else if (isGraphObject(root)) {
      this.rootObjectId = root.id;
      this.pathToRootIds = [];
    } else {
      this.rootObjectId = root.object.id;
      this.pathToRootIds = root.relations?.map((r) => r.id) ?? [];
    }
    this.path = path;
    return { rootObjectId: this.rootObjectId, pathToRootIds: this.pathToRootIds };
  }

  // For objects, we default to collapsed.
  isPathExpanded(path: Path): boolean {
    return this.expansionsByPath.get(path) || false;
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    this.expansionsByPath.set(path, isExpanded);
    this.expansionLocalStorageCache.update(this.expansionsByPath);
  }

  togglePathExpanded(path: Path) {
    this.expansionsByPath.set(path, !this.expansionsByPath.get(path));
    this.expansionLocalStorageCache.update(this.expansionsByPath);
  }

  // For groups, we default to expanded.
  isGroupExpanded(path: Path) {
    return this.expansionsByPath.get(path) ?? true;
  }

  setGroupExpanded(path: Path, isExpanded: boolean) {
    this.expansionsByPath.set(path, isExpanded);
    this.expansionLocalStorageCache.update(this.expansionsByPath);
  }

  toggleGroupExpanded(path: Path) {
    this.expansionsByPath.set(path, !this.isGroupExpanded(path));
    this.expansionLocalStorageCache.update(this.expansionsByPath);
  }

  /**
   * Sets the search string for the tree.
   *
   * Before updating, the text cache is updated with the current text of all nodes.
   * See {@link textsByObjectId} for details.
   */
  setSearch(search: string) {
    logger.debug(`Setting search to "${search}"`);
    if (this.search === "") this.textsByObjectId.clear();
    walkTree(this.root, (node) => {
      this.textsByObjectId.set(node.object.id, node.object.text.toLocaleLowerCase());
    });
    this.search = search;
  }

  /**
   * Update the tree filter. Note that the tree only keeps a partial filter, and
   * the full filter is computed by merging the partial filter with the settings
   * store. That's why when you pass a function, only a partial filter is returned.
   */
  updateFilter(filter: SetStateAction<Partial<Filter>>) {
    this.partialFilter = typeof filter === "function" ? filter(this.partialFilter) : filter;
  }

  protected applyFilter(treeNode: TreeNode): boolean {
    const hidePointerSection = Object.getPrototypeOf(this).constructor.name === "Tree";
    function walk(treeNode: TreeNode, filter: Filter) {
      if (hidePointerSection) {
        treeNode.childrenGroupsById.pointer.nodes = [];
      }
      if (filter.hidePinnedSection) {
        treeNode.childrenGroupsById.pinned.nodes = [];
      }
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => walk(child, filter));
      });
      if (treeNode instanceof RootTreeNode) {
        return true;
      }
      if (filter.hideBackrelations && treeNode.isBackrelation) {
        return false;
      }
      /** Parent from the perspective of the graph, not the current tree */
      const isParentRelation =
        treeNode.isBackrelation &&
        (treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id ||
          treeNode.relationWithParent.relationType.id === defaultRelationTypes.sublist.id);

      const isSameRelationAsParentToGrandparent =
        treeNode.relationWithParent.id === treeNode.parent.relationWithParent?.id;
      const grandparentNotInBreadcrumb = !(treeNode.parent.parent instanceof PathToRootNode);
      if (filter.hideAllParents && isParentRelation) {
        return false;
      } else if (filter.hideAllRootParents && isParentRelation && treeNode.object.isRoot) {
        return false;
      } else if (filter.hideDirectParent && isSameRelationAsParentToGrandparent && grandparentNotInBreadcrumb) {
        return false;
      }
      return true;
    }
    return walk(treeNode, this.filter);
  }

  protected applySearch(treeNode: TreeNode) {
    if (!this.search) return;
    logger.debug("Applying search:", `"${this.search}"`);
    const search = this.search;
    const texts = this.textsByObjectId;
    function walk(treeNode: TreeNode) {
      let searchMatchInDescendants = false;
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => {
          walk(child);
          const match = child.isSearchMatch || (child.searchMatchInDescendants && child.isExpanded);
          searchMatchInDescendants = searchMatchInDescendants || match;
          return match;
        });
      });
      if (treeNode instanceof DescendantTreeNode) {
        const text = texts.get(treeNode.object.id);
        treeNode.isSearchMatch = text && search ? text.includes(search) : true;
        treeNode.searchMatchInDescendants = searchMatchInDescendants;
      }
    }
    walk(treeNode);
  }

  updateSortByOption(sortOption: SortOption) {
    this.sortOption = sortOption;
    this.sortOptionLocalStorageCache.save(this.sortOption);
  }

  protected applySort(treeNode: TreeNode) {
    const { mode, direction } = this.sortOption;
    const negation = direction === "asc" ? -1 : 1;

    const sortFn = (a: DescendantTreeNode, b: DescendantTreeNode) =>
      mode === "manual"
        ? comparePositions(a.position, b.position)
        : compareTimestamps(a.object[mode], b.object[mode], a.position, b.position) * negation;

    const walk = (node: TreeNode) => {
      node.childrenGroups.forEach((group) => {
        group.nodes.sort(sortFn);
        group.nodes.forEach(walk);
      });
    };

    walk(treeNode);
  }

  async createChildOfRootAndFocus({ nodeProps }: { nodeProps?: GraphNodeProps } = {}) {
    const { node, relation } = await this.createChildNode({ parent: this.root, nodeProps });
    const path = this.root.childrenGroupsById.all.createChildPath(relation);
    this.setFocusedNode(path, "end", true);
    return { node, relation, path };
  }

  /**
   * Creates a new node as a child of the given parent node. If no parent is
   * given, the node is created as a child of the root node.
   */
  async createChildNode(props: {
    parent?: BaseTreeNode;
    nodeProps?: GraphNodeProps;
    relationProps?: { id?: string; relationTypeId?: string };
    after?: Positioner<DescendantTreeNode>;
  }) {
    const parent: BaseTreeNode = props.parent ?? this.root;
    const { node, relation } = await this.graphStore.addChildNode({
      parentId: props.parent?.object.id ?? this.rootObjectId,
      nodeProps: props.nodeProps,
      relationProps: props.relationProps,
      after: props.after instanceof DescendantTreeNode ? props.after.relationWithParent : props.after,
    });

    let path: string = parent.createChildPath(relation);
    if (props.after instanceof DescendantTreeNode && props.after.parentGroup.id === "pinned") {
      this.graphStore.pinRelations(parent.object.id, [relation.id], props.after.relationWithParent);
      path = parent.createChildPath(relation, "pinned");
    }

    return { node, relation, path };
  }

  /**
   * Set new parent for tree node by pointing the relation to the current parent
   * to the new parent. If `after` is provided, the node will be positioned
   * after the given node in the new parent's children.
   */
  async setParentOfNode(treeNodeId: string, newParentObjectId: string, after?: Positioner<DescendantTreeNode>) {
    const treeNode = this.getNodeOrThrow(treeNodeId);
    const txs: TxCombined = [];
    txs.push({
      type: "replaceRelationLink",
      transaction: {
        direction: getSideOrThrow(treeNode.relationWithParent, treeNode.parent.object.id),
        relationId: treeNode.relationWithParent.id,
        replaceWith: { type: "existing-object", id: newParentObjectId },
        after: after instanceof DescendantTreeNode ? after.relationWithParent : after,
      },
    });
    await this.graphStore.applyCombinedTransaction(txs);
  }

  async setObjectOnNode(treeNodeId: string, object: GraphObject, after?: Positioner<DescendantTreeNode>) {
    const treeNode = this.getNodeOrThrow(treeNodeId);
    await this.graphStore.replaceRelationLink({
      direction: getSideOrThrow(treeNode.relationWithParent, treeNode.object.id),
      relationId: treeNode.relationWithParent.id,
      replaceWith: { type: "existing-object", id: object.id },
      after: after instanceof DescendantTreeNode ? after.relationWithParent : after,
    });
  }

  /**
   * Remove the current object on the node and replace it with a new object with
   * the same raw text
   *
   * This is used in cases where the user was typing and then selects something
   * from autocomplete to replace the current node with. Then they change their
   * mind and want to revert to back to editing a new object.
   */
  async replaceObjectAtNodeWithCopy(treeNodeId: string) {
    const treeNode = this.getNodeOrThrow(treeNodeId);
    let node: GraphNode | null = null;
    try {
      node = await this.graphStore.addNode({ nodeProps: { content: treeNode.object.text.slice(0, -1) } });
      await this.setObjectOnNode(treeNode.path, node);
    } catch (error) {
      if (node) {
        await this.graphStore.removeNode({ nodeId: node.id });
      }
      throw error;
    }
  }

  async deleteSelection() {
    const selection = this.selectionWithNodes;
    if (selection?.type === "node") {
      if (selection?.subtreeRoots.some((node) => node instanceof PointerTreeNode)) {
        return;
      }
      await this.graphStore.applyCombinedTransaction(
        selection.nodes.map((treeNode) => ({
          type: "removeRelation",
          transaction: { relationId: treeNode.relationWithParent.id },
        })),
      );
      const node = getNextAbove(selection.top);
      if (node) {
        this.setFocusedNode(node.path);
      }
    }
  }

  /**
   * Moves the selection to the bottom of the sibling above.
   */
  async indentSelection(): Promise<boolean> {
    const selection = this.selectionWithNodes;
    if (selection?.subtreeRoots.some((node) => node instanceof PointerTreeNode)) {
      return true;
    }
    for (const nodes of groupSiblings(selection?.subtreeRoots ?? [])) {
      if (nodes.length === 0) continue;
      const { parentGroup, siblingAbove } = nodes[0];
      if (parentGroup !== siblingAbove?.parentGroup) continue; // can't indent selections that span groups
      await siblingAbove.addChildren(nodes, -1);
    }
    return true;
  }

  /**
   * Moves the selection to the grandparent, just below the current
   * parent (while in the pinned section, it positions below the current parent
   * in both sections)
   */
  dedentSelection(): boolean {
    const selection = this.selectionWithNodes;
    if (selection?.subtreeRoots.some((node) => node instanceof PointerTreeNode)) {
      return true;
    }
    for (const nodes of groupSiblings(selection?.subtreeRoots ?? [])) {
      if (nodes.length === 0) continue;
      const parent = nodes[0].parent;
      if (parent instanceof RootTreeNode) continue; // can't dedent past the root
      parent.parentGroup.add(nodes, parent);
    }
    return true;
  }

  /**
   * Splits an object and returns the newly created graph object, relation, and
   * expected path to it in the tree.
   *
   * If no chips are provided, we split the node as if the cursor is at the end of the node.
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
  async split(treeNode: TreeNode, chips?: { before: Chip[]; after: Chip[] }) {
    if (!(treeNode.object instanceof GraphNode) && chips !== undefined) {
      logger.warn("Chips are ignored when splitting non-node objects", { chips });
      chips = undefined;
    }
    if (treeNode instanceof PointerTreeNode) {
      logger.debug("Cannot split PointerTreeNode");
      return;
    }

    // Split strategies

    function splitToChild(treeNode: TreeNode) {
      const relationId = uuid();
      const txs: TxCombined = [];
      if (chips) {
        txs.push({
          type: "updateNode",
          transaction: { nodeId: treeNode.object.id, nodeProps: { content: chips.before } },
        });
      }
      txs.push({
        type: "addChildNode",
        transaction: {
          parentId: treeNode.object.id,
          nodeProps: { content: chips?.after ?? [] },
          relationProps: { id: relationId },
        },
      });
      return { txs, newNodePath: treeNode.childrenGroupsById.all.path + "/" + relationId };
    }

    function splitToSiblingBelow(treeNode: DescendantTreeNode) {
      const relationId = uuid();
      const txs: TxCombined = [];

      // Set the current object's content to the content before the cursor
      if (chips) {
        txs.push({
          type: "updateNode",
          transaction: { nodeId: treeNode.object.id, nodeProps: { content: chips.before } },
        });
      }

      // Create sibling after the current node with the content after the cursor
      txs.push({
        type: "addChildNode",
        transaction: {
          parentId: treeNode.parent.object.id,
          after: treeNode.parentGroup.id === "pinned" ? -1 : treeNode.relationWithParent,
          nodeProps: { content: chips?.after ?? [] },
          relationProps: { id: relationId },
        },
      });

      if (treeNode.parentGroup.id === "pinned") {
        // If we are splitting inside pinned group and new node is a sibling,
        // we want the new node to be pinned after the old node
        txs.push({
          type: "pinRelation",
          transaction: { objectId: treeNode.parent.object.id, relationId, after: treeNode.relationWithParent },
        });
      } else if (treeNode.parentGroup.id === "noteContent") {
        txs.push({
          type: "addRelationToList",
          transaction: {
            objectId: treeNode.parent.object.id,
            relationId,
            listType: "noteContent",
            after: treeNode.relationWithParent,
          },
        });
      }
      return { txs, newNodePath: treeNode.parentGroup.path + "/" + relationId };
    }

    function moveToNewRelationBelow(treeNode: DescendantTreeNode) {
      const txs: TxCombined = [];

      // create new relation below pointing to existing node
      const relationId = uuid();
      txs.push({
        type: "addRelation",
        transaction: {
          fromId: treeNode.parent.object.id,
          toId: treeNode.object.id,
          relationType: defaultRelationTypes.child,
          id: relationId,
          after: treeNode.relationWithParent,
        },
      });

      // create new blank node and point existing relation to it
      const newNodeId = uuid();
      txs.push({
        type: "addNode",
        transaction: {
          nodeProps: { content: [], id: newNodeId },
        },
      });
      txs.push({
        type: "replaceRelationLink",
        transaction: {
          direction: getSideOrThrow(treeNode.relationWithParent, treeNode.object.id),
          relationId: treeNode.relationWithParent.id,
          replaceWith: { type: "existing-object", id: newNodeId },
        },
      });

      if (treeNode.parentGroup.id === "pinned" || treeNode.parentGroup.id === "noteContent") {
        txs.push({
          type: "addRelationToList",
          transaction: {
            objectId: treeNode.parent.object.id,
            relationId,
            listType: treeNode.parentGroup.id,
            after: treeNode.relationWithParent,
          },
        });
      }

      // where to focus
      const newNodePath = treeNode.parentGroup.path + "/" + relationId;

      // expansion updates
      const expansions = { [treeNode.path]: false, [newNodePath]: treeNode.isExpanded };
      return { txs, newNodePath, expansions };
    }

    // Choose split strategy based on cursor position and node expansion

    let changes: { txs: TxCombined; newNodePath: string; expansions?: Record<string, boolean> };
    if (treeNode instanceof DescendantTreeNode) {
      const isExpandedWithChildren = treeNode.isExpanded && treeNode.childCount > 0;
      const atStartOfLine =
        chips?.before
          .map((c) => c.value)
          .join()
          .trim() === "";
      const atStartOfChildWithContent =
        treeNode.relationWithParent?.relationType.id === defaultRelationTypes.child.id &&
        treeNode.relationWithParent?.to.id === treeNode.object.id &&
        atStartOfLine &&
        treeNode.object.text.length > 0;
      if (isExpandedWithChildren) {
        if (atStartOfChildWithContent) {
          changes = moveToNewRelationBelow(treeNode);
        } else {
          changes = splitToChild(treeNode);
        }
      } else {
        if (atStartOfLine) {
          changes = moveToNewRelationBelow(treeNode);
        } else {
          changes = splitToSiblingBelow(treeNode);
        }
      }
    } else {
      changes = splitToChild(treeNode);
    }

    // Execute split

    await this.graphStore.applyCombinedTransaction(changes.txs);

    if (changes.expansions) {
      for (const [path, expanded] of Object.entries(changes.expansions)) {
        this.setPathExpanded(path, expanded);
      }
    }
    if (changes.newNodePath) {
      this.setFocusedNode(changes.newNodePath, "start", true);
    }
  }

  async splitNote(treeNode: DescendantTreeNode, chips: { before: Chip[]; after: Chip[] }) {
    const noteNode = treeNode.parent;
    if (!isNoteContent(treeNode)) {
      logger.warn("Attempted to split non-note content");
      return;
    }
    if (!(noteNode instanceof DescendantTreeNode)) {
      logger.debug("Ignoring split in non-DescendantTreeNode");
      return;
    }
    const noteParent = noteNode.parent;
    if (!noteParent) {
      logger.warn("Can't split note in context where it has no parent");
      return;
    }
    // Create a new node as a sibling of the current note

    const txs: TxCombined = [];

    // Update the content of the original node
    if (chips.before) {
      txs.push({
        type: "updateNode",
        transaction: { nodeId: treeNode.object.id, nodeProps: { content: chips.before } },
      });
    }

    // Create new note below, under the orignal note's parent
    const newNoteId = uuid();
    const newRelationId = uuid();
    txs.push({
      type: "addChildNode",
      transaction: {
        parentId: noteParent.object.id,
        nodeProps: { id: newNoteId, content: [] },
        relationProps: { id: newRelationId },
        after: noteNode.relationWithParent ?? undefined,
      },
    });

    // Add a child to the new note with the content after the split
    const relationIdsInNewNote: string[] = [];
    if (chips.after.length > 0) {
      const newNoteContentRelationId = uuid();
      txs.push({
        type: "addChildNode",
        transaction: {
          parentId: newNoteId,
          nodeProps: { content: chips.after },
          relationProps: { id: newNoteContentRelationId },
        },
      });
      relationIdsInNewNote.push(newNoteContentRelationId);
    }

    // Move content of current note below to new note
    const treeNodeIndex = noteNode.childrenGroupsById.noteContent.nodes.indexOf(treeNode);
    if (treeNodeIndex !== -1) {
      for (const node of noteNode.childrenGroupsById.noteContent.nodes.slice(treeNodeIndex + 1)) {
        const relationId = node.relationWithParent.id;
        txs.push({
          type: "replaceRelationLink",
          transaction: {
            direction: getSideOrThrow(node.relationWithParent, node.parent.object.id),
            relationId,
            replaceWith: { type: "existing-object", id: newNoteId },
          },
        });
        relationIdsInNewNote.push(relationId);
      }
    } else {
      logger.warn("No note content nodes to move");
    }

    // If there's no content, add an empty node
    if (relationIdsInNewNote.length === 0) {
      const relationId = uuid();
      txs.push({
        type: "addChildNode",
        transaction: {
          parentId: newNoteId,
          relationProps: { id: relationId },
        },
      });
      relationIdsInNewNote.push(relationId);
    }

    // Add relations to the note content list
    txs.push({
      type: "addRelationToList",
      transaction: {
        objectId: newNoteId,
        relationId: relationIdsInNewNote,
        listType: "noteContent",
      },
    });

    // Apply the transactions
    await this.graphStore.applyCombinedTransaction(txs);

    // Focus first child of new note
    if (relationIdsInNewNote[0]) {
      const relationToNewNote = this.graphStore.getRelation(newRelationId);
      if (relationToNewNote) {
        const pathToNewNote = noteNode.parentGroup.createChildPath(relationToNewNote);
        this.setFocusedNode(createPath(pathToNewNote, "noteContent", relationIdsInNewNote[0]));
      }
    }
  }

  /**
   * Moves the selected or focused nodes up one step.
   */
  async moveSelectedNodesUp(): Promise<boolean> {
    if (!this.selectionWithNodes) return false;
    if (this.sortOption.mode !== "manual") return false;
    const { subtreeRoots: nodes } = this.selectionWithNodes;
    // Moves noes only when they belong to same parent and same group.
    const shouldMove = nodes.every(
      (n) =>
        n.parentGroup.id === nodes[0].parentGroup.id &&
        n.parent.id === nodes[0].parent.id &&
        !(n instanceof PointerTreeNode),
    );

    if (!shouldMove) {
      return false;
    }

    const first = nodes[0];

    const siblingAbove = first.siblingAbove;
    const siblingAboveParent = first.parent instanceof DescendantTreeNode && first.parent.siblingAbove;
    if (siblingAbove) {
      // swap with sibling above in same group
      if (siblingAbove.parentGroup !== first.parentGroup) return false;
      const siblingTwoAbove = siblingAbove.siblingAboveInSameGroup ?? undefined;
      await this.graphStore.updateRelationPositionsList({
        containingNodeId: first.parent.object.id,
        groupId: first.parentGroup.id,
        objectAndRelationIds: nodes.map((root) => ({
          objectId: extractPointedAtObjectId(root),
          relationId: root.relationWithParent.id,
        })),
        afterObjectId: siblingTwoAbove?.relationWithParent.id,
      });
      return true;
    } else if (siblingAboveParent) {
      // we're at the top - move underneath the next parent above
      await siblingAboveParent.addChildren(nodes, -1);
      return true;
    }
    return false;
  }

  /**
   * Moves the selected or focused nodes down one step.
   */
  async moveSelectedNodesDown(): Promise<boolean> {
    //Todo: This is pretty similar to moveSelectedNodesUp. Can unify them?
    if (!this.selectionWithNodes) return false;
    if (this.sortOption.mode !== "manual") return false;
    const { subtreeRoots: nodes } = this.selectionWithNodes;
    // Moves noes only when they belong to same parent and same group.
    const shouldMove = nodes.every(
      (n) =>
        n.parentGroup.id === nodes[0].parentGroup.id &&
        n.parent.id === nodes[0].parent.id &&
        !(n instanceof PointerTreeNode),
    );

    if (!shouldMove) {
      return false;
    }

    const last = nodes[nodes.length - 1];

    const siblingBelow = last.siblingBelow;
    const siblingBelowParent = last.parent instanceof DescendantTreeNode && last.parent.siblingBelow;
    if (siblingBelow) {
      // swap with sibling below (if in same group)
      if (siblingBelow.parentGroup !== last.parentGroup) return false;
      await this.graphStore.updateRelationPositionsList({
        containingNodeId: last.parent.object.id,
        groupId: extractGroupId(last.parentGroup),
        objectAndRelationIds: nodes.map((root) => ({
          objectId: extractPointedAtObjectId(root),
          relationId: root.relationWithParent.id,
        })),
        afterObjectId: siblingBelow?.relationWithParent.id,
      });
      return true;
    } else if (siblingBelowParent) {
      // we're at the bottom - move underneath next node
      await siblingBelowParent.addChildren(nodes, 0);
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

  private moveNodeSelectionHead(dir: "up" | "down"): boolean {
    const selection = this.selectionWithNodes;
    if (!selection || !(selection.type === "editor" || selection.type === "node")) return false;
    switch (selection.type) {
      case "editor":
        this.selectionStack.reset();
        this.selection = { type: "node", anchorNodeId: selection.treeNode.id, headNodeId: selection.treeNode.id };
        return true;
      case "node":
        const { anchor, head } = selection;
        if (!this.selection || this.selection.type === "editor") {
          // This should never happen. The selection and computed selection types should always match.
          logger.warn("Selection type mismatch", { selection, current: this.selection, extra: "cat" });
          return false;
        }
        switch (dir) {
          case "up":
            const latestDown = this.selectionStack.popBy("down");
            if (latestDown) {
              this.selection.headNodeId = latestDown.headId;
              return true;
            }
            const nextUp = head.siblingAboveInSameGroup || head.parent;
            if (!nextUp || !(nextUp instanceof DescendantTreeNode)) {
              return false;
            }
            this.selectionStack.push(dir, this.selection.headNodeId);
            this.selection.headNodeId = nextUp.path;
            return true;
          case "down":
            const latestUp = this.selectionStack.popBy("up");
            if (latestUp) {
              this.selection.headNodeId = latestUp.headId;
              return true;
            }
            //If anchor is a descendant of head, move head towards anchor instead of subtree.
            //Example: 1 <-H        Output: 1
            //           2 <-A                2 <-A,H
            //         3                    3
            //Example: 1 <-H,A        Output: 1 <-A
            //           2                      2
            //         3                      3 <-H
            const nextDown = head.isAncestorOf(anchor) ? getNextBelow(head) : getNextSubtreeBelow(head) ?? null;
            if (!nextDown || nextDown.parentGroup.id !== head.parentGroup.id) return false;
            this.selectionStack.push(dir, this.selection.headNodeId);
            this.selection = { type: "node", anchorNodeId: anchor.path, headNodeId: nextDown.path };
            return true;
          default:
            return dir satisfies never;
        }
      default:
        return selection satisfies never;
    }
  }

  /**
   * Move selection from the current node to the next one up.
   */
  moveEditorSelectionUp(position: TreeNodeContentSelectionPosition = "end"): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const treeNode = selection.type === "editor" ? selection.treeNode : selection.top;
    const next = getNextAbove(treeNode);
    if (!next) return false;
    this.setFocusedNode(next.path, position, false);
    return true;
  }

  /**
   * Move selection from the current node to the next one down.
   */
  moveEditorSelectionDown(position: TreeNodeContentSelectionPosition = "end"): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const next = selection.type === "editor" ? getNextBelow(selection.treeNode) : getNextSubtreeBelow(selection.bottom);
    if (!next) return false;
    const firstChild = next.visibleChildren[0];
    if (firstChild && isNoteContent(firstChild)) {
      this.setFocusedNode(firstChild.path, position, false);
      return true;
    } else {
      this.setFocusedNode(next.path, position, false);
      return true;
    }
  }

  /**
   * Convert a node selection to an editor selection or and editor selection to
   * no selection.
   */
  escapeSelection() {
    if (this.selection === null) {
      return;
    } else if (this.selection?.type === "node") {
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
  updateSubtreeExpansionAndSelectionPathState(path: Path, newPath: Path) {
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
      if (this.selection.anchorNodeId.includes(path)) {
        this.selection = { ...this.selection, anchorNodeId: this.selection.anchorNodeId.replace(path, newPath) };
      }
      if (this.selection.headNodeId.includes(path)) {
        this.selection = { ...this.selection, headNodeId: this.selection.headNodeId.replace(path, newPath) };
      }
    } else if (this.selection?.type === "editor" && this.selection.treeNodeId === path) {
      this.selection = { ...this.selection, treeNodeId: newPath };
    }
  }

  collapseAtSelection() {
    const selection = this.selection;
    if (selection?.type !== "editor") return;
    this.setPathExpanded(selection.treeNodeId, false);
  }

  expandAtSelection() {
    const selection = this.selection;
    if (selection?.type !== "editor") return;
    this.setPathExpanded(selection.treeNodeId, true);
  }

  clear(root: Root) {
    this.setRoot(root, "");
    this.path = "";
    this.expansionsByPath.clear();
    // this.textsCache.clear();
    this.textsByObjectId.clear();
    this.expansionLocalStorageCache.clear();
    this.sortOptionLocalStorageCache.clear();
  }

  serialize(): SerializedTree {
    return {
      id: this.id,
      pathToRootIds: this.pathToRootIds,
      rootObjectId: this.rootObjectId,
      expansionsByPath: Object.fromEntries(this.expansionsByPath.entries()),
    };
  }

  /**
   * Returns true if the deserialization was successful.
   */
  deserializeInPlace(data: SerializedTree): boolean {
    const expansionsByPath = new Map<string, boolean>();
    Object.entries(data.expansionsByPath ?? {}).forEach(([key, value]) => expansionsByPath.set(key, value));

    // The following code that gets all objects for pathToRoot and rootObject only to revert back to the IDs might seem a bit silly
    // but is useful for making sure that the deserialization is valid and that all objects are present in the graph store.
    let pathToRoot: GraphRelation[] = [];
    for (const id of data.pathToRootIds) {
      const relation = this.graphStore.getRelation(id);
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
    this.pathToRootIds = pathToRoot.map((r) => r.id);
    this.rootObjectId = rootObject.id;
    this.expansionsByPath = expansionsByPath;
    return true;
  }
}

type Filter = {
  hideBackrelations: boolean;
  hideAllParents: boolean;
  hideAllRootParents: boolean;
  hideDirectParent: boolean;
  hidePinnedSection: boolean;
};
