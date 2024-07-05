import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { Position } from "@/app/util";

export class PathToRootNode {
  object: GraphObject;
  relationToChild: GraphRelation;
  parent: PathToRootNode | null;
  child: PathToRootNode | TreeNode;
  path: string;
  depth: number;

  constructor({
    object,
    relationToChild,
    child,
    parent = null,
    path = "",
    depth = 0,
  }: {
    object: GraphObject;
    relationToChild: GraphRelation;
    child: PathToRootNode | RootTreeNode;
    parent?: PathToRootNode | null;
    path?: string;
    depth?: number;
  }) {
    this.object = object;
    this.relationToChild = relationToChild;
    this.parent = parent;
    this.child = child;
    this.path = path;
    this.depth = depth;
  }
}

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

/**
 * When you expand a node in the tree, it's children are shown in distinct
 * groups. For now, that's just "pinned" and "all", but you can imagine later
 * having "suggested" or "related" groups as well. Or even having supporting
 * groupby operations like "by type" or "by relation" (similar to Linear).
 */
export type Group = PinnedGroup | AllGroup;
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
export type ChildrenGroups = [PinnedGroup, AllGroup];
export type ChildrenGroupsOmitParent = [Omit<PinnedGroup, "parent">, Omit<AllGroup, "parent">];
