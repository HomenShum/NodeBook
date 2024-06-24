import { GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationType } from "./GraphRelation";

/**
 * Specifies a position in a list. Can be an index (number), the id of an object
 * in the list (string), or the object itself.
 */
export type Positioner<T extends { id: string }> = number | string | T;

export type RelationDirectionForObject = "from" | "to";

export type TxAddChildNode = {
  parentId: string;
  nodeProps?: GraphNodeProps;
  after?: Positioner<GraphRelation>;
};

export type TxRemoveNode = {
  nodeId: string;
};

export type TxAddRelation = {
  fromId: string;
  toId: string;
  relationType?: GraphRelationType;
};

export type TxReplaceRelationLink = {
  direction: RelationDirectionForObject;
  relationId: string;
  replaceWith:
    | { type: "new-node"; nodeProps?: GraphNodeProps }
    | { type: "existing-node"; id: string }
    | { type: "existing-relation"; id: string };
};
