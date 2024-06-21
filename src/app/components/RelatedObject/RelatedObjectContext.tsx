import { createContext, useContext } from "react";

import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { PathLink, relationsPathToParentChild } from "@/app/util";
import { DescendantTreeNode, getAncestorsAsArray, isUnlabelledChild } from "@/app/view/Tree";

type RelationPathAndSiblings = {
  treeNode: DescendantTreeNode;
  /** Ordered list of relations from the root to this relation's parent */
  pathToParentRelations: GraphRelation[];
  /** Ordered list of nodes from the root to this relation's parent */
  pathToParentWithOrderedObjects: PathLink[];
  /** Path to this node as a string */
  pathToNodeStr: string;
  /** The node at the end of this path */
  object: GraphObject;
  /** Parent node of this in path */
  parent: GraphObject;
  /** The relation connecting the parent to this node */
  relation: GraphRelation;
  /** Sibling relation above this one */
  siblingAbove?: GraphRelation;
  /** Sibling relation below this one */
  siblingBelow?: GraphRelation;
  isChild: boolean;
  openRelationTypeMenu: () => void;
};

const RelationAtPathContext = createContext<{
  treeNode: DescendantTreeNode;
  openRelationTypeMenu: () => void;
} | null>(null);

export const useRelationAtPath = (): RelationPathAndSiblings => {
  const context = useContext(RelationAtPathContext);
  if (!context) {
    throw new Error("useRelationAtPath must be used within a RelationAtPathContext provider");
  }
  const { treeNode, openRelationTypeMenu } = context;
  const pathToParentRelations = getAncestorsAsArray(treeNode.parent).map((p) => p.relationToChild);
  const pathToParentWithOrderedObjects = relationsPathToParentChild(pathToParentRelations);
  return {
    treeNode: treeNode,
    object: treeNode.object,
    relation: treeNode.relationWithParent,
    parent: treeNode.parent.object,
    pathToNodeStr: treeNode.path,
    pathToParentRelations,
    pathToParentWithOrderedObjects,
    siblingAbove: treeNode.siblingAbove?.relationWithParent,
    siblingBelow: treeNode.siblingBelow?.relationWithParent,
    isChild: isUnlabelledChild(treeNode),
    openRelationTypeMenu,
  };
};

export const RelationAtPathProvider = RelationAtPathContext.Provider;
