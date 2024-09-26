import { env } from "@/app/envFrontend";
import { defaultRelationTypes } from "@/app/graph/constants";
import { PositionedRelation } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { getOtherObjectOrThrow } from "@/app/graph/utils";
import { SublistTree } from "@/app/tree/SublistTree";
import { Tree } from "@/app/tree/Tree";
import { comparePositions, createRouteUrl, Position } from "@/app/util";
import logger from "@/lib/logger";

export class PathToRootNode {
  object: GraphObject;
  relationToChild: GraphRelation;
  child: PathToRootNode | TreeNode;
  parent: PathToRootNode | null = null;

  constructor({
    object,
    relationToChild,
    child,
  }: {
    object: GraphObject;
    relationToChild: GraphRelation;
    child: PathToRootNode | RootTreeNode;
  }) {
    this.object = object;
    this.relationToChild = relationToChild;
    this.child = child;
  }

  get path(): string {
    return this.parent ? this.parent.path + "/" + this.relationToChild.id : "";
  }

  get depth(): number {
    return this.parent ? this.parent.depth + 1 : 0;
  }
}

export abstract class BaseTreeNode {
  tree: Tree;
  object: GraphObject;
  abstract childrenGroups: ChildrenGroups;
  abstract relationWithParent: GraphRelation | null;
  abstract path: string;
  protected constructor({ tree, object }: { tree: Tree; object: GraphObject }) {
    this.tree = tree;
    this.object = object;
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
    return { pinned: this.childrenGroups[0], all: this.childrenGroups[1], pointer: this.childrenGroups[2] };
  }

  createChildPath(child: DescendantTreeNode | GraphRelation, groupId: GroupId = "all"): string {
    return this.childrenGroupsById[groupId].createChildPath(child);
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
}

export class RootTreeNode extends BaseTreeNode {
  id: string = "";
  path: string = "";
  depth: number = 0;
  childrenGroups: ChildrenGroups;
  parent: PathToRootNode | null = null;
  relationWithParent: GraphRelation | null = null;
  constructor({ tree }: { tree: Tree }) {
    super({ tree, object: tree.rootObject });
    this.childrenGroups = [
      new PinnedGroup({ tree, parent: this }),
      new AllGroup({ tree, parent: this }),
      new PointerGroup({ tree, parent: this }),
    ];
  }

  hydrate() {
    try {
      this.hydrateAncestors();
      this.id = this.path;
      this.path = this.parent ? this.tree.path.substring(0, this.tree.path.lastIndexOf("/")) : "";
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
      const relation = pathToRoot[i];
      if (!relation) {
        break;
      }
      const parentNode: PathToRootNode = new PathToRootNode({
        object: getOtherObjectOrThrow(relation, currentNode.object.id),
        relationToChild: relation,
        child: currentNode,
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
      this.path = this.parent ? this.tree.path.substring(0, this.tree.path.lastIndexOf("/")) : "";
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
    //In sublist view, we do not want pinned items.
    this.childrenGroups.forEach((group) => {
      if (group.id === "pointer") {
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
  id: string;
  //Todo: Remove this, just a temporary workaround for sublist view,
  constructor({
    object,
    position,
    relationWithParent,
    group,
    isSearchMatch = false,
    searchMatchInDescendants = false,
  }: {
    object: GraphObject;
    position: Position;
    relationWithParent: GraphRelation;
    group: BaseGroup;
    isSearchMatch?: boolean;
    searchMatchInDescendants?: boolean;
  }) {
    super({ tree: group.tree, object });
    this.path = group.path + "/" + relationWithParent.id;
    this.id = this.path;
    this.depth = group.parent.depth + 1;
    this.childrenGroups = [
      new PinnedGroup({ tree: group.tree, parent: this }),
      new AllGroup({ tree: group.tree, parent: this }),
      new PointerGroup({ tree: group.tree, parent: this }),
    ];
    this.parentGroup = group;
    this.isSearchMatch = isSearchMatch;
    this.searchMatchInDescendants = searchMatchInDescendants;
    this.relationWithParent = relationWithParent;
    this.position = position;
  }

  hydrate(visitedMap: {} = {}, isConnectedSublist: boolean = false) {
    this.childrenGroups.forEach((group) => group.hydrate());
  }

  get parent() {
    return this.parentGroup.parent;
  }

  get isExpanded() {
    return this.tree.isPathExpanded(this.path);
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

  async setParent(parent: BaseTreeNode, after?: Positioner<DescendantTreeNode>) {
    if (this.parent.object === parent.object) return;
    await this.tree.setParentOfNode(this.id, parent, after);
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
    });
    this.sourceNode = sourceNode;
  }

  hydrate() {
    this.childrenGroups.forEach((group) => {
      if (group.id === "all") {
        group.hydrate();
      }
    });
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

/**
 * When you expand a node in the tree, it's children are shown in distinct
 * groups. For now, that's just "pinned" and "all", but you can imagine later
 * having "suggested" or "related" groups as well. Or even having supporting
 * groupby operations like "by type" or "by relation" (similar to Linear).
 */
export abstract class BaseGroup {
  abstract id: "all" | "pinned" | "pointer";
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

  hydrate() {
    const nodes = [];
    for (const { relation, position } of this.relationsWithPositions) {
      try {
        const node = new DescendantTreeNode({
          object: getOtherObjectOrThrow(relation, this.parent.object.id),
          position,
          relationWithParent: relation,
          group: this,
        });
        // Only hydrate children if the parent is expanded. This is important to avoid
        // infinite recursion since we allow circular references in the graph.
        if (this.parent.isExpanded && this.isExpanded) {
          node.hydrate();
        }
        nodes.push(node);
      } catch (e) {
        logger.error("Error hydrating node", e);
      }
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
// TODO Can define a type for this?

export class PinnedGroup extends BaseGroup {
  id = "pinned" as const; // TODO shouldn't be necessary
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
  id = "all" as const; // TODO shouldn't be necessary
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
    const isSublistTree = Object.getPrototypeOf(this.tree).constructor.name === `${SublistTree.name}`;
    const isHydrateBySubtreeRootNode =
      Object.getPrototypeOf(this.parent).constructor.name === `${SublistRootTreeNode.name}`;
    if (!isSublistTree || !isHydrateBySubtreeRootNode) {
      return;
    }
    const visitedMap: Record<string, boolean> = {};
    visitedMap[this.parent.object.id] = true;
    const group = this;
    const pointers: PointerTreeNode[] = [];
    const shouldHydrate: boolean[] = [];

    function buildPointerFlatList(treeNode: TreeNode): void {
      for (const { relation, position } of treeNode.object.relationsWithPositions.sort((a, b) =>
        comparePositions(a.position, b.position),
      )) {
        //Ignore all incoming relations, ignore parent
        if (relation.to.id === treeNode.object.id) {
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
        shouldHydrate.push(!isSublist);

        if (isSublist) {
          buildPointerFlatList(descendantNode);
        }
      }
    }

    buildPointerFlatList(this.parent);

    this.nodes = pointers;
    for (let i = 0; i < this.nodes.length; i++) {
      if (shouldHydrate[i]) {
        this.nodes[i].hydrate();
      }
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
export type ChildrenGroups = [PinnedGroup, AllGroup, PointerGroup];
export type GroupId = BaseGroup["id"];
