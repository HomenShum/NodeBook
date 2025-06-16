import { LexicalEditor } from "lexical";
import { untracked } from "mobx";

import { env } from "@/app/envFrontend";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode, PositionedRelation } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { getOtherObject, getOtherObjectOrThrow } from "@/app/graph/utils";
import { SearchTree } from "@/app/tree/SearchTree";
import { SublistTree } from "@/app/tree/SublistTree";
import { Tree } from "@/app/tree/Tree";
import { isNoteContent } from "@/app/tree/utils";
import { comparePositions, createRouteUrl, Position } from "@/app/util";
import { GLOBAL_ROOT_ID } from "@/lib/constants";
import logger from "@/lib/logger";

export class PathToRootNode {
  object: GraphObject;
  relationToChild: GraphRelation;
  child: PathToRootNode | TreeNode;
  childGroupId: GroupId;
  parent: PathToRootNode | null = null;

  constructor({
    object,
    relationToChild,
    childGroupId,
    child,
  }: {
    object: GraphObject;
    relationToChild: GraphRelation;
    childGroupId: GroupId;
    child: PathToRootNode | RootTreeNode;
  }) {
    this.object = object;
    this.relationToChild = relationToChild;
    this.child = child;
    this.childGroupId = childGroupId;
  }

  get path(): string {
    return this.parent ? this.parent.path + `/${this.childGroupId}/` + this.relationToChild.id : "";
  }

  get depth(): number {
    return this.parent ? this.parent.depth + 1 : 0;
  }
}

export abstract class BaseTreeNode {
  id: string = "";
  tree: Tree;
  object: GraphObject;
  lexicalEditor: LexicalEditor | null = null;
  abstract childrenGroups: ChildrenGroups;
  abstract relationWithParent: GraphRelation | null;
  abstract path: string;

  protected constructor({ tree, object }: { tree: Tree; object: GraphObject }) {
    this.tree = tree;
    this.object = object instanceof GraphNode ? untracked(() => object) : object;
  }

  /**
   * Create a new graph node and adds it as a child of this node. Returns the
   * path to the new node in the "all" section of the children, if new node is
   * created in "pinned" section, returns the pinned path.
   */
  async createChild(props: Omit<Parameters<Tree["createChildNode"]>[0], "parent"> = {}) {
    const { path } = await this.tree.createChildNode({ ...props, parent: this });
    return path;
  }

  pinChild(child: DescendantTreeNode | DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    const children = Array.isArray(child) ? child : [child];
    this.object.pinChildRelation(
      children.map((c) => c.relationWithParent),
      after instanceof DescendantTreeNode ? after.relationWithParent : after,
    );
  }

  get childrenGroupsById() {
    return {
      noteContent: this.childrenGroups[0],
      pinned: this.childrenGroups[1],
      all: this.childrenGroups[2],
      pointer: this.childrenGroups[3],
    };
  }

  createChildPath(child: DescendantTreeNode | GraphRelation, groupId: GroupId = "all"): string {
    return this.childrenGroupsById[groupId].createChildPath(child);
  }

  /**
   * Count of children nodes across all groups. These children may be hidden if this
   * node is collapsed. To get the count of visible children, use `visibleChildren`.
   */
  get childCount(): number {
    return this.childrenGroups.reduce((acc, group) => (group.id !== "noteContent" ? acc + group.nodes.length : acc), 0);
  }

  /**
   * Returns list of visible children nodes. If this node is collapsed, it will
   * return an empty list.
   */
  get visibleChildren(): DescendantTreeNode[] {
    const children: DescendantTreeNode[] = [];
    for (const group of this.childrenGroups) {
      if (group.id === "noteContent") {
        children.push(...group.nodes);
      } else if (this.isExpanded && group.isExpanded) {
        children.push(...group.nodes);
      }
    }
    return children;
  }

  get isExpanded() {
    return this.tree.isPathExpanded(this.path);
  }

  get isBackrelation(): boolean {
    return this.relationWithParent?.from.id === this.object.id;
  }

  isDescendantOf(node: TreeNode): boolean {
    return this.path.startsWith(node.path) && this.path !== node.path;
  }

  isAncestorOf(node: TreeNode): boolean {
    return node.path.startsWith(this.path) && this.path !== node.path;
  }

  registerLexicalEditor(editor: LexicalEditor) {
    this.lexicalEditor = editor;
  }

  get isTodoItem(): boolean {
    return this.object instanceof GraphNode && typeof this.object.isChecked === "boolean";
  }
}

export class RootTreeNode extends BaseTreeNode {
  path: string = "";
  depth: number = 0;
  childrenGroups: ChildrenGroups;
  parent: PathToRootNode | null = null;
  relationWithParent: GraphRelation | null = null;
  constructor({ tree }: { tree: Tree }) {
    super({ tree, object: tree.rootObject });
    this.childrenGroups = [
      new NoteContentGroup({ tree, parent: this }),
      new PinnedGroup({ tree, parent: this }),
      new AllGroup({ tree, parent: this }),
      new PointerGroup({ tree, parent: this }),
    ];
  }

  hydrate() {
    try {
      this.hydrateAncestors();
      this.path = this.parent?.path || "";
      this.id = this.path;
      this.depth = this.parent ? this.parent.depth + 1 : 0;
      this.hydrateChildren();
    } catch (e) {
      logger.error("error hydrating node", e);
      if (env.isFrontend) {
        //Force page refresh, we do not want a partial broken state.
        window.location.href = createRouteUrl("home");
      }
    }
    return this;
  }

  protected hydrateAncestors() {
    const pathToRoot = this.tree.pathToRoot;
    let currentNode: PathToRootNode | RootTreeNode = this;
    for (let i = pathToRoot.length - 1; i >= 0; i--) {
      const { relation, childGroupId } = pathToRoot[i];
      if (!relation) {
        break;
      }
      const parentObject = getOtherObject(relation, currentNode.object.id);
      if (!parentObject) {
        logger.warn("Could not find parent object for relation during hydration", relation);
        currentNode.parent = null;
        return;
      }
      const parentNode: PathToRootNode = new PathToRootNode({
        object: parentObject,
        relationToChild: relation,
        child: currentNode,
        childGroupId,
      });
      currentNode.parent = parentNode;
      if (currentNode instanceof RootTreeNode) {
        currentNode.relationWithParent = parentNode.relationToChild;
      }
      currentNode = parentNode;
    }
  }

  protected hydrateChildren() {
    this.childrenGroups.forEach((group) => group.hydrate());
  }

  get isExpanded() {
    return true;
  }
}

export class SublistRootTreeNode extends RootTreeNode {
  hydrate() {
    try {
      this.hydrateAncestors();
      this.id = this.path;
      this.path = this.parent?.path || "";
      this.depth = this.parent ? this.parent.depth + 1 : 0;
      this.hydrateChildren();
    } catch (e) {
      logger.error("error hydrating node", e);
      if (env.isFrontend) {
        //Force page refresh, we do not want a partial broken state.
        window.location.href = createRouteUrl("home");
      }
    }
    return this;
  }

  protected hydrateChildren() {
    //In sublist view, we do not want "all" group items on root child list level.
    this.childrenGroups.forEach((group) => {
      if (group.id === "pointer" || group.id === "pinned") {
        group.hydrate();
      }
    });
  }
}

export class DescendantTreeNode extends BaseTreeNode {
  parentGroup: BaseGroup;
  relationWithParent: GraphRelation;
  childrenGroups: ChildrenGroups;
  position: Position;
  isSearchMatch: boolean;
  searchMatchInDescendants: boolean;
  path: string;
  depth: number;
  isEditable: boolean;
  //Todo: Remove this, just a temporary workaround for sublist view,
  constructor({
    object,
    position,
    relationWithParent,
    group,
    isSearchMatch = false,
    searchMatchInDescendants = false,
    isEditable = true,
  }: {
    object: GraphObject;
    position: Position;
    relationWithParent: GraphRelation;
    group: BaseGroup;
    isSearchMatch?: boolean;
    searchMatchInDescendants?: boolean;
    isEditable?: boolean;
  }) {
    super({ tree: group.tree, object });
    this.path = group.path + "/" + relationWithParent.id;
    this.id = this.path;
    this.depth = group.parent.depth + 1;
    this.childrenGroups = [
      new NoteContentGroup({ tree: group.tree, parent: this }),
      new PinnedGroup({ tree: group.tree, parent: this }),
      new AllGroup({ tree: group.tree, parent: this }),
      new PointerGroup({ tree: group.tree, parent: this }),
    ];
    this.parentGroup = group;
    this.isSearchMatch = isSearchMatch;
    this.searchMatchInDescendants = searchMatchInDescendants;
    this.relationWithParent = relationWithParent;
    this.position = position;
    this.isEditable = isEditable;
  }

  hydrate() {
    this.childrenGroups.forEach((group) => group.hydrate());
  }

  get parent() {
    return this.parentGroup.parent;
  }

  get isExpanded() {
    return this.tree.isPathExpanded(this.path);
  }

  get isAtCanonicalPath() {
    const object = this.object;
    let canonicalPath = object.canonicalRelation;
    let treePath: GraphRelation | null = this.relationWithParent;

    // Avoid max depth
    let depth = 0;
    const maxDepth = 40;

    while (depth <= maxDepth) {
      // Have to terminate at same time
      if (canonicalPath === null || treePath === null) {
        if (canonicalPath === treePath) {
          return true;
        }
        return false;
      }

      if (canonicalPath?.id !== treePath.id) {
        return false;
      }

      // Traverse
      const canonicalObject = getOtherObject(canonicalPath, object.id);
      const treeObject = getOtherObject(treePath, object.id);

      if (canonicalObject?.id === GLOBAL_ROOT_ID || treeObject?.id === GLOBAL_ROOT_ID) {
        if (canonicalObject?.id === treeObject?.id) {
          return true;
        }
        return false;
      }

      canonicalPath = canonicalObject?.canonicalRelation || null;
      treePath = treeObject?.canonicalRelation || null;
      depth++;
    }
    return true;
  }

  get instanceCountInPath() {
    let n = 1;
    let parent: TreeNode | null = this.parent;
    while (parent) {
      if (parent.object.id === this.object.id) {
        n++;
      }
      parent = parent.parent instanceof PathToRootNode ? null : parent.parent;
    }
    return n;
  }

  get siblingAbove(): DescendantTreeNode | null {
    const nodeIndex = this.parentGroup.nodes.indexOf(this);
    if (nodeIndex < 0) {
      throw new Error("Node not found in group");
    } else if (nodeIndex === 0) {
      // get last node in previous group
      let prevGroupIdx = this.parent.childrenGroups.indexOf(this.parentGroup) - 1;
      let prevGroup: BaseGroup | undefined = this.parent.childrenGroups[prevGroupIdx];
      while (!(prevGroup && prevGroup.isExpanded && prevGroup.nodes.length > 0) && prevGroupIdx >= 0) {
        prevGroupIdx--;
        prevGroup = this.parent.childrenGroups[prevGroupIdx];
      }
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
      let nextGroupIndex = this.parent.childrenGroups.indexOf(this.parentGroup) + 1;
      let nextGroup = this.parent.childrenGroups[nextGroupIndex];
      while (
        !(nextGroup && nextGroup.isExpanded && nextGroup.nodes.length > 0) &&
        nextGroupIndex < this.parent.childrenGroups.length
      ) {
        nextGroupIndex++;
        nextGroup = this.parent.childrenGroups[nextGroupIndex];
      }
      return nextGroup?.nodes[0] || null;
    } else {
      return this.parentGroup.nodes[nodeIndex + 1] || null;
    }
  }

  get siblingBelowInSameGroup(): DescendantTreeNode | null {
    const node = this.siblingBelow;
    return node?.parentGroup === this.parentGroup ? node : null;
  }

  async setParent(parent: BaseTreeNode, after?: Positioner<DescendantTreeNode>, groupId?: GroupId) {
    if (this.parent.object === parent.object) return;
    await this.tree.setParentOfNode(this.id, parent.object.id, after, groupId);
  }

  /**
   * Moves the node to the given position in the parent's children.
   */
  async addChildren(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    await this.childrenGroupsById.all.add(nodes, after);
  }

  async setObject(object: GraphObject) {
    await this.tree.setObjectOnNode(this.id, object);
  }
}

export class PointerTreeNode extends DescendantTreeNode {
  private sourceNode: DescendantTreeNode;

  constructor(sourceNode: DescendantTreeNode) {
    super({
      object: sourceNode.object,
      position: sourceNode.position,
      relationWithParent: sourceNode.relationWithParent,
      group: sourceNode.parentGroup,
      isSearchMatch: sourceNode.isSearchMatch,
      searchMatchInDescendants: sourceNode.searchMatchInDescendants,
      isEditable: sourceNode.isEditable,
    });
    this.sourceNode = sourceNode;
  }

  hydrate() {
    this.childrenGroups.forEach((group) => {
      if (group.id !== "pointer") {
        group.hydrate();
      }
    });
  }

  get showRelation(): boolean {
    return this.sourceNode.parent instanceof RootTreeNode;
  }

  get siblingAbove(): DescendantTreeNode | null {
    //Flat List
    const nodeIndex = this.parentGroup.nodes.map((n) => n.id).indexOf(this.id);
    if (nodeIndex < 0) {
      throw new Error("Current not found in group. Are you high on salted margarita?");
    }
    return this.parentGroup.nodes[nodeIndex - 1] || null;
  }

  get siblingBelow(): DescendantTreeNode | null {
    //Flat List
    const nodeIndex = this.parentGroup.nodes.map((n) => n.id).indexOf(this.id);
    if (nodeIndex < 0) {
      throw new Error("Current not found in group. Are you high on chicken salami?");
    }
    return this.parentGroup.nodes[nodeIndex + 1] || null;
  }
}
export type TreeNode = PointerTreeNode | RootTreeNode | DescendantTreeNode;

export const groupIds = ["all", "pinned", "pointer", "noteContent"] as const;

export type GroupId = (typeof groupIds)[number];

/**
 * When you expand a node in the tree, it's children are shown in distinct
 * groups. For now, that's just "pinned" and "all", but you can imagine later
 * having "suggested" or "related" groups as well. Or even having supporting
 * groupby operations like "by type" or "by relation" (similar to Linear).
 */
export abstract class BaseGroup {
  abstract id: GroupId;
  tree: Tree;
  parent: TreeNode;
  nodes: DescendantTreeNode[];
  abstract relationsWithPositions: PositionedRelation[];
  abstract path: string;
  abstract add(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>): Promise<void>;

  protected constructor({ tree, parent, nodes = [] }: { tree: Tree; parent: TreeNode; nodes?: DescendantTreeNode[] }) {
    this.tree = tree;
    this.parent = parent;
    this.nodes = nodes;
  }

  hydrate_subset(subsetRelations: Set<string>): Set<string> {
    const newlyHidden = new Set<string>();
    const missingIds = [];

    // We'll collect both visible and hidden nodes in a single ordered list
    const allNodes: DescendantTreeNode[] = [];
    // Keep track of which nodes are hidden
    const hiddenNodeIds = new Set<string>();

    for (const { relation, position } of this.relationsWithPositions) {
      const isVisible = subsetRelations.has(relation.id);

      if (!isVisible) {
        newlyHidden.add(relation.id);
      }

      const object = getOtherObject(relation, this.parent.object.id);
      if (!object) {
        missingIds.push(relation.from.id, relation.to.id);
        const data = {
          relationId: relation.id,
          fromId: relation.from.id,
          toId: relation.to.id,
          parentId: this.parent.object.id,
        };
        continue;
      }

      // This hides bullets which are part of the noteContent list. That way you don't see them inside
      // the note content *and* the children below the note.
      if (this.id !== "noteContent" && this.parent.object.noteContentRelationsList.has(relation.id)) {
        continue;
      }

      const node = new DescendantTreeNode({
        object,
        position,
        relationWithParent: relation,
        group: this,
      });

      if (
        // Only hydrate children if the parent is expanded. This is important to avoid
        // infinite recursion since we allow circular references in the graph.
        (this.parent.isExpanded && this.isExpanded) ||
        // Except the note content group. In this case, we always hydrate the children, because this group
        // is visible even if the node is not expanded.
        (this.id === "noteContent" && node.instanceCountInPath <= 1)
      ) {
        node.hydrate();
      }

      // Add all nodes to the list in original order
      allNodes.push(node);

      // Mark hidden nodes by their ID
      if (!isVisible) {
        // Check if the node would be hidden by hideDirectParent setting
        const filter = this.tree.filter;
        const isParentRelation =
          node.isBackrelation &&
          (node.relationWithParent.relationType.id === defaultRelationTypes.child.id ||
            node.relationWithParent.relationType.id === defaultRelationTypes.sublist.id);

        const isSameRelationAsParentToGrandparent = node.relationWithParent.id === node.parent.relationWithParent?.id;
        const grandparentNotInBreadcrumb = !(node.parent.parent instanceof PathToRootNode);
        const nodeIsNoteContent = isNoteContent(node);

        const wouldBeHiddenByDirectParent =
          filter.hideDirectParent &&
          isSameRelationAsParentToGrandparent &&
          grandparentNotInBreadcrumb &&
          !nodeIsNoteContent;

        const wouldBeHiddenByAllParents = filter.hideAllParents && isParentRelation;

        const wouldBeHiddenByAllRootParents = filter.hideAllRootParents && isParentRelation && node.object.isRoot;

        // Skip adding to filteredNodesByPath if it would be hidden by filter settings
        if (wouldBeHiddenByDirectParent || wouldBeHiddenByAllParents || wouldBeHiddenByAllRootParents) {
          continue;
        }

        hiddenNodeIds.add(node.id);
      }
    }

    if (missingIds.length > 0) {
      // logger.debug("Loading missing ids", missingIds);
      this.tree.loadMissingIdsDuringHydration(missingIds);
    }

    // Store all nodes in the original order
    this.nodes = allNodes;

    if (!(this.tree instanceof SearchTree)) {
      throw new Error("This method is only supported for SearchTree");
    }

    // This section now filters the nodes by the hidden node IDs
    // Store hidden node IDs in the tree for filtering later
    const parentPath = this.parent.path;
    if (!this.tree.filteredNodesByPath.has(parentPath)) {
      this.tree.filteredNodesByPath.set(parentPath, {} as Record<GroupId, DescendantTreeNode[]>);
    }

    // Store the hidden node IDs
    const filterMap = this.tree.filteredNodesByPath.get(parentPath)!;
    (filterMap as any)[`${this.id}_hidden_ids`] = hiddenNodeIds;

    // Process contiguous groups for efficient handling
    // We now sort the nodes by position to make it easier to find contiguous groups
    allNodes.sort((a, b) => comparePositions(a.position, b.position));
    if (hiddenNodeIds.size > 0) {
      // Find contiguous blocks of hidden nodes in the original order
      const contiguousGroups: DescendantTreeNode[][] = [];
      let currentGroup: DescendantTreeNode[] = [];

      for (const node of allNodes) {
        if (hiddenNodeIds.has(node.id)) {
          currentGroup.push(node);
        } else if (currentGroup.length > 0) {
          contiguousGroups.push([...currentGroup]);
          currentGroup = [];
        }
      }

      if (currentGroup.length > 0) {
        contiguousGroups.push(currentGroup);
      }

      // Store the contiguous groups
      (filterMap as any)[`${this.id}_contiguous`] = contiguousGroups;
    }

    return newlyHidden;
  }

  hydrate() {
    const nodes = [];
    const missingIds = [];
    for (const { relation, position } of this.relationsWithPositions) {
      const object = getOtherObject(relation, this.parent.object.id);
      if (!object) {
        missingIds.push(relation.from.id, relation.to.id);
        const data = {
          relationId: relation.id,
          fromId: relation.from.id,
          toId: relation.to.id,
          parentId: this.parent.object.id,
        };
        continue;
      }

      // This hides bullets which are part of the noteContent list. That way you don't see them inside
      // the note content *and* the children below the note.
      if (this.id !== "noteContent" && this.parent.object.noteContentRelationsList.has(relation.id)) {
        continue;
      }

      // Check for mentions in the object's content that need to be loaded
      untracked(() => {
        if (object instanceof GraphNode && object.content) {
          const mentionIds = object.content.filter((block) => block.type === "mention").map((block) => block.value);
          if (mentionIds.length > 0) {
            missingIds.push(...mentionIds);
          }
        }
      });

      const node = new DescendantTreeNode({
        object,
        position,
        relationWithParent: relation,
        group: this,
      });

      if (
        // Only hydrate children if the parent is expanded. This is important to avoid
        // infinite recursion since we allow circular references in the graph.
        (this.parent.isExpanded && this.isExpanded) ||
        // Except the note content group. In this case, we always hydrate the children, because this group
        // is visible even if the node is not expanded.
        (this.id === "noteContent" && node.instanceCountInPath <= 1)
      ) {
        node.hydrate();
      }
      nodes.push(node);
    }
    if (missingIds.length > 0) {
      // logger.debug("Loading missing ids", missingIds);
      this.tree.loadMissingIdsDuringHydration(missingIds);
    }
    this.nodes = nodes;
  }

  get isExpanded() {
    return this.tree.isGroupExpanded(this.path);
  }

  createChildPath(child: DescendantTreeNode | GraphRelation): string {
    const relation = child instanceof DescendantTreeNode ? child.relationWithParent : child;
    return this.path + "/" + relation.id;
  }
}

export class PinnedGroup extends BaseGroup {
  id = "pinned" as const;
  constructor(props: { tree: Tree; parent: TreeNode; nodes?: DescendantTreeNode[] }) {
    super(props);
  }

  get path() {
    return this.parent.path + "/pinned";
  }

  get relationsWithPositions() {
    return this.parent.object.pinnedRelationsWithPositions;
  }

  /**
   * Moves the nodes into the given group while maintaining any expanded or
   * selected states.
   */
  async add(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    for (const node of nodes) {
      // add the nodes as children of the parent, at the bottom (if they're not already there)
      await node.setParent(this.parent, -1);
      // then add to pinned group by pinning (at the specified position if provided)
      this.parent.pinChild(node, after);
      this.tree.updateSubtreeExpansionAndSelectionPathState(node.path, this.createChildPath(node));
      after = node;
    }
    this.tree.setPathExpanded(this.parent.path, true);
  }
}

export class AllGroup extends BaseGroup {
  id = "all" as const;
  constructor(props: { tree: Tree; parent: TreeNode; nodes?: DescendantTreeNode[] }) {
    super(props);
  }

  get path() {
    return this.parent.path + "/all";
  }

  get relationsWithPositions() {
    return this.parent.object.relationsWithPositions;
  }

  /**
   * Moves the nodes into the given group while maintaining any expanded or
   * selected states.
   */
  async add(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    for (const node of nodes) {
      await node.setParent(this.parent, after);
      this.tree.updateSubtreeExpansionAndSelectionPathState(node.path, this.createChildPath(node));
      after = node;
    }
    this.tree.setPathExpanded(this.parent.path, true);
  }
}

export class NoteContentGroup extends BaseGroup {
  id = "noteContent" as const;
  constructor(props: { tree: Tree; parent: TreeNode; nodes?: DescendantTreeNode[] }) {
    super(props);
  }

  get path() {
    return this.parent.path + "/noteContent";
  }

  get relationsWithPositions() {
    return this.parent.object.noteContentRelationsWithPositions;
  }

  /**
   * Moves the nodes into the given group while maintaining any expanded or
   * selected states.
   */
  async add(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    for (const node of nodes) {
      await node.setParent(this.parent, after, "noteContent");
      this.parent.object.addRelationToNoteContent(
        node.relationWithParent,
        after instanceof DescendantTreeNode ? after.relationWithParent : after,
      );
      this.tree.updateSubtreeExpansionAndSelectionPathState(node.path, this.createChildPath(node));
      after = node;
    }
    this.tree.setPathExpanded(this.parent.path, true);
  }
}

export class PointerGroup extends BaseGroup {
  id = "pointer" as const;

  constructor(props: { tree: Tree; parent: TreeNode; nodes?: DescendantTreeNode[] }) {
    super(props);
  }

  get path() {
    return this.parent.path + "/pointer";
  }

  get relationsWithPositions() {
    return this.parent.object.relationsWithPositions;
  }

  hydrate() {
    const isSublistTree = this.tree instanceof SublistTree;
    const isHydrateBySubtreeRootNode = this.parent instanceof SublistRootTreeNode;

    if (!isSublistTree || !isHydrateBySubtreeRootNode) {
      return;
    }
    const visitedMap: Record<string, boolean> = {};
    visitedMap[this.parent.object.id] = true;
    const group = this;
    const pointers: PointerTreeNode[] = [];

    function buildPointerFlatList(treeNode: TreeNode): void {
      for (const { relation, position } of treeNode.object.relationsWithPositions.sort((a, b) =>
        comparePositions(a.position, b.position),
      )) {
        //Ignore all incoming relations, ignore parent
        if (relation.to.id === treeNode.object.id && relation.relationType.id === defaultRelationTypes.child.id) {
          continue;
        }

        // Ignore relations that are not related to the current node (not quite sure why this is needed)
        if (treeNode.object.id !== relation.from.id && treeNode.object.id !== relation.to.id) {
          continue;
        }

        const childObject = getOtherObjectOrThrow(relation, treeNode.object.id);
        if (visitedMap[childObject.id]) {
          continue;
        }
        visitedMap[childObject.id] = true;

        const descendantNode = new DescendantTreeNode({
          object: childObject,
          position,
          relationWithParent: relation,
          group,
        });

        // Descend into sublist and collect pointers to leaf nodes
        const isSublist =
          relation.relationType.id === defaultRelationTypes.sublist.id && relation.from.id === treeNode.object.id;

        pointers.push(new PointerTreeNode(descendantNode));

        if (isSublist) {
          buildPointerFlatList(descendantNode);
        }
      }
    }

    buildPointerFlatList(this.parent);

    this.nodes = pointers;
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].hydrate();
    }
  }
  /**
   * Moves the nodes into the given group while maintaining any expanded or
   * selected states.
   */
  async add(nodes: DescendantTreeNode[], after?: Positioner<DescendantTreeNode>) {
    for (const node of nodes) {
      await node.setParent(this.parent, after);
      this.tree.updateSubtreeExpansionAndSelectionPathState(node.path, this.createChildPath(node));
      after = node;
    }
    this.tree.setPathExpanded(this.parent.path, true);
  }
}
export type ChildrenGroups = [NoteContentGroup, PinnedGroup, AllGroup, PointerGroup];
