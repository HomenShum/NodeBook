import { GraphObject } from "@/app/model/GraphObject";
import { GraphRelation } from "@/app/model/GraphRelation";
import { PathLink, Position } from "@/app/util";
import { createContext, useContext } from "react";

export type RelationPathAndSiblings = {
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
  setReplacing: (v: boolean) => void;
  position: Position;
};

const RelationAtPathContext = createContext<RelationPathAndSiblings | null>(null);

export const useRelationAtPath = () => {
  const context = useContext(RelationAtPathContext);
  if (!context) {
    throw new Error("useRelationAtPath must be used within a RelationAtPathContext provider");
  }
  return context;
};

export const RelationAtPathProvider = RelationAtPathContext.Provider;
