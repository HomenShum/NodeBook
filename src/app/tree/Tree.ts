import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";
import { SetStateAction } from "react";

import { Chip, GraphNode, GraphNodeProps } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { defaultRelationTypes, GraphStore } from "@/app/graph/GraphStore";
import { Positioner, TxCombined } from "@/app/graph/GraphTransactionTypes";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { getSideOrThrow } from "@/app/graph/utils";
import { SerializedTree } from "@/app/persistence/SerializedData";
import { comparePositions, ObjectPath, uuid } from "@/app/util";
import appLogger from "@/lib/logger";

import { BaseTreeNode, DescendantTreeNode, PathToRootNode, RootTreeNode, TreeNode } from "./nodes";
import { EditorSelectionPosition, TreeSelection, TreeSelectionWithNodes } from "./selection";
import {
  createDescendantTreeNodesById,
  getAncestorsAsArray,
  getNextAbove,
  getNextBelow,
  getNextSubtreeBelow,
  getSubtreesBetween,
  groupSiblings,
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
    const { rootObject, pathToRoot } = this.setRoot(root);
    this.rootObject = rootObject;
    this.pathToRoot = pathToRoot;
    this.search = search;
    this.partialFilter = filter;
    this.expansionsByPath = expansions;
    this.selection = selection;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable<this, "partialFilter">(this, {
      selection: observable,
      rootObject: observable.ref,
      pathToRoot: observable.shallow,
      search: observable,
      expansionsByPath: observable,
      partialFilter: observable,
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
      splitNode: action,
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

  private partialFilter: Partial<Filter> = {};

  /** Expanded paths in the tree. */
  public expansionsByPath: Map<string, boolean>;

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
      hideBundles: this.settingsStore.hideBundles,
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
    if (!this.selection) {
      return null;
    } else if (this.selection.type === "editor") {
      const node = this.state.descendantTreeNodesById.get(this.selection.treeNodeId);
      if (!node) {
        logger.warn("Selection node not found", this.selection.treeNodeId);
        return null;
      }
      return { ...this.selection, treeNode: node, subtreeRoots: [node], top: node, bottom: node };
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
  setFocusedNode(treeNodeId: string | null, position: EditorSelectionPosition = "end") {
    this.selection = treeNodeId ? { type: "editor", treeNodeId, position } : null;
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
  setRoot(root: DescendantTreeNode | ObjectPath | GraphObject) {
    logger.debug("Setting tree root", root);
    if (root instanceof DescendantTreeNode) {
      this.rootObject = root.object;
      this.pathToRoot = getAncestorsAsArray(root).map((node) => node.relationToChild);
    } else if (root instanceof GraphObject) {
      this.rootObject = root;
      this.pathToRoot = [];
    } else {
      this.rootObject = root.object;
      this.pathToRoot = root.relations || [];
    }
    return { rootObject: this.rootObject, pathToRoot: this.pathToRoot };
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

  private applyFilter(treeNode: TreeNode): boolean {
    function walk(treeNode: TreeNode, filter: Filter) {
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
      if (filter.hideBundles && treeNode.object instanceof GraphNode && treeNode.object.isBundle) {
        return false;
      }
      /** Parent from the perspective of the graph, not the current tree */
      const isParentRelation =
        treeNode.isBackrelation && treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id;
      const isParentRelationToGrandparent =
        isParentRelation &&
        treeNode.object.id === treeNode.parent.parent?.object.id &&
        !(treeNode.parent.parent instanceof PathToRootNode);
      if (filter.hideAllParents && isParentRelation) {
        return false;
      } else if (filter.hideAllRootParents && isParentRelation && treeNode.object.isRoot) {
        return false;
      } else if (filter.hideDirectParent && isParentRelationToGrandparent) {
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
        treeNode.isSearchMatch = search ? text?.includes(search) ?? true : true;
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

  async createChildOfRootAndFocus() {
    const { node, relation } = await this.createChildNode({ parent: this.root });
    const path = this.root.childrenGroupsById.all.createChildPath(relation);
    this.setFocusedNode(path);
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
    return this.graphStore.addChildNode({
      parentId: props.parent?.object.id ?? this.rootObject.id,
      nodeProps: props.nodeProps,
      relationProps: props.relationProps,
      after: props.after instanceof DescendantTreeNode ? props.after.relationWithParent : props.after,
    });
  }

  /**
   * Set new parent for tree node by pointing the relation to the current parent
   * to the new parent. If `after` is provided, the node will be positioned
   * after the given node in the new parent's children.
   */
  async setParentOfNode(treeNodeId: string, newParent: BaseTreeNode, after?: Positioner<DescendantTreeNode>) {
    const treeNode = this.getNodeOrThrow(treeNodeId);
    await this.graphStore.replaceRelationLink({
      direction: getSideOrThrow(treeNode.relationWithParent, treeNode.parent.object.id),
      relationId: treeNode.relationWithParent.id,
      replaceWith: { type: "existing-object", id: newParent.object.id },
      after: after instanceof DescendantTreeNode ? after.relationWithParent : after,
    });
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

  async deleteSelection() {
    const selection = this.selectionWithNodes;
    if (selection?.type === "node") {
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
    for (const nodes of groupSiblings(selection?.subtreeRoots ?? [])) {
      if (nodes.length === 0) continue;
      const parent = nodes[0].parent;
      if (parent instanceof RootTreeNode) continue; // can't dedent past the root
      parent.parentGroup.add(nodes, parent);
    }
    return true;
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

    if (!(treeNode.object instanceof GraphNode)) {
      throw new Error("Only splitting nodes is supported for now.");
    }

    const oldNode = treeNode;
    const newNodeId = uuid();
    const after = treeNode.parentGroup.id === "pinned" ? -1 : oldNode.relationWithParent;

    const reassignRelationTxs: TxCombined = oldNode.object.relations.filter(r => r.id != oldNode.relationWithParent.id).map((r) => {
      return {
        type: "replaceRelationLink",
        transaction: {
          relationId: r.id,
          direction: r.from.id === oldNode.object.id ? "from" : "to",
          replaceWith: {type: "existing-object", id: newNodeId}
        }
      }
    })

    const results = await this.graphStore.applyCombinedTransaction([
      {
        type: "addChildNode",
        transaction: {
          parentId: oldNode.parent.object.id,
          after,
          nodeProps: { content: contentAfterSelection, id: newNodeId },
        }
      },
      ...reassignRelationTxs,
      {
        type: "updateNode",
        transaction: { nodeId: oldNode.object.id, nodeProps: { content: contentBeforeSelection } }
      }
    ]);

    const newNode = results[0].node as GraphNode;
    const relation = results[0].relation as GraphRelation;

    //If we are splitting inside pinned group,
    //we want the new node to be pinned after the old node
    if(oldNode.parentGroup.id === "pinned"){
      oldNode.parent.object.pinChildRelation(relation, oldNode?.relationWithParent);
    }

    const newNodePath = oldNode.parentGroup.path + "/" + relation.id;

    //If old node was expanded during splitting, expand the new node as well.
    if(oldNode.isExpanded){
      this.setPathExpanded(newNodePath, true)
    }

    window.setFocusedNode = this.setFocusedNode;

    console.log("path",newNodePath);
    this.setFocusedNode(newNodePath);

    return { node: newNode, relation, path: newNodePath }
  }

  /**
   * Moves the selected or focused nodes up one step.
   */
  async moveSelectedNodesUp(): Promise<boolean> {
    if (!this.selectionWithNodes) return false;
    const { top, subtreeRoots } = this.selectionWithNodes;
    // don't allow moving nodes that belong to different groups
    if (subtreeRoots.some((n) => n.parentGroup !== top.parentGroup)) {
      return false;
    }
    const siblingAbove = top.siblingAbove;
    const siblingAboveParent = top.parent instanceof DescendantTreeNode && top.parent.siblingAbove;
    if (siblingAbove) {
      // swap with sibling above in same group
      if (siblingAbove.parentGroup !== top.parentGroup) return false;
      const siblingTwoAbove = siblingAbove.siblingAboveInSameGroup ?? undefined;
      top.parentGroup.move(subtreeRoots, siblingTwoAbove);
      return true;
    } else if (siblingAboveParent) {
      // we're at the top - move underneath the next parent above
      await siblingAboveParent.addChildren(subtreeRoots, -1);
      return true;
    }
    return false;
  }

  /**
   * Moves the selected or focused nodes down one step.
   */
  async moveSelectedNodesDown(): Promise<boolean> {
    if (!this.selectionWithNodes) return false;
    const { bottom, subtreeRoots } = this.selectionWithNodes;
    // don't allow moving nodes that belong to different groups
    if (subtreeRoots.some((n) => n.parentGroup !== bottom.parentGroup)) {
      return false;
    }
    const siblingBelow = bottom.siblingBelow;
    const siblingBelowParent = bottom.parent instanceof DescendantTreeNode && bottom.parent.siblingBelow;
    if (siblingBelow) {
      // swap with sibling below (if in same group)
      if (siblingBelow.parentGroup !== bottom.parentGroup) return false;
      bottom.parentGroup.move(subtreeRoots, siblingBelow);
      return true;
    } else if (siblingBelowParent) {
      // we're at the bottom - move underneath next node
      await siblingBelowParent.addChildren(subtreeRoots, 0);
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
    if (!selection) return false;
    if (selection.type === "editor") {
      // convert editor selection to node selection
      this.selection = { type: "node", anchorNodeId: selection.treeNode.id, headNodeId: selection.treeNode.id };
      return true;
    } else if (selection.type === "node") {
      if (selection.type !== this.selection?.type) {
        // This should never happen. The selection and computed selection types should always match.
        logger.warn("Selection type mismatch", { selection, current: this.selection });
        return false;
      }
      const { anchor, head, bottom } = selection;
      if (dir === "up") {
        const nextNode = getNextAbove(head) ?? null;
        if (!nextNode || nextNode.parentGroup.id !== head.parentGroup.id) return false;
        if (head === anchor) {
          // Selection is collapsed on single node. If the selection is moving up a subtree, move the anchor with it.
          this.selection.headNodeId = nextNode.path;
          if (nextNode.isAncestorOf(anchor)) {
            this.selection.anchorNodeId = nextNode.path;
          }
        } else if (head === bottom) {
          // Head is at the bottom end of selection range. Move to next node above, unless that's
          // within the anchors subtree, in which case bring the head up to the anchor.
          this.selection.headNodeId = nextNode.isDescendantOf(anchor) ? anchor.path : nextNode.path;
        } else {
          // Head is at the top end of selection range. Move to next node above.
          this.selection.headNodeId = nextNode.path;
        }
      } else {
        const nextNode = getNextSubtreeBelow(head) ?? null;
        if (!nextNode || nextNode.parentGroup.id !== head.parentGroup.id) return false;
        this.selection = { type: "node", anchorNodeId: anchor.path, headNodeId: nextNode.path };
      }
      return true;
    } else {
      return selection satisfies never;
    }
  }

  /**
   * Move selection from the current node to the next one up.
   */
  moveEditorSelectionUp(position: EditorSelectionPosition = "end"): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const treeNode = selection.type === "editor" ? selection.treeNode : selection.top;
    const next = getNextAbove(treeNode);
    if (!next) return false;
    this.setFocusedNode(next.path, position);
    return true;
  }

  /**
   * Move selection from the current node to the next one down.
   */
  moveEditorSelectionDown(position: EditorSelectionPosition = "end"): boolean {
    const selection = this.selectionWithNodes;
    if (!selection) return false;
    const next = selection.type === "editor" ? getNextBelow(selection.treeNode) : getNextSubtreeBelow(selection.bottom);
    if (!next) return false;
    this.setFocusedNode(next.path, position);
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

  clear(root: GraphRelation[]) {
    this.pathToRoot = root;
    this.expansionsByPath.clear();
    // this.textsCache.clear();
    this.textsByObjectId.clear();
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
    this.pathToRoot = pathToRoot;
    this.rootObject = rootObject;
    this.expansionsByPath = expansionsByPath;
    return true;
  }
}

type Filter = {
  hideBackrelations: boolean;
  hideBundles: boolean;
  hideAllParents: boolean;
  hideAllRootParents: boolean;
  hideDirectParent: boolean;
  hidePinnedSection: boolean;
};
