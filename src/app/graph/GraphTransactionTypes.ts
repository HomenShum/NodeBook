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

export type TxRemoveRelation = {
  relationId: string;
};

export type TxReplaceRelationLink = {
  direction: RelationDirectionForObject;
  relationId: string;
  replaceWith:
    | { type: "new-node"; nodeProps?: GraphNodeProps }
    | { type: "existing-node"; id: string }
    | { type: "existing-relation"; id: string };
};

type TxMapping = {
  addChildNode: TxAddChildNode;
  removeNode: TxRemoveNode;
  addRelation: TxAddRelation;
  removeRelation: TxRemoveRelation;
  replaceRelationLink: TxReplaceRelationLink;
};

// TODO: probably can be done with less boilerplate code?
type TxCombinedPart =
  | {
      type: "addChildNode";
      transaction: TxAddChildNode;
    }
  | {
      type: "removeNode";
      transaction: TxRemoveNode;
    }
  | {
      type: "addRelation";
      transaction: TxAddRelation;
    }
  | {
      type: "removeRelation";
      transaction: TxRemoveRelation;
    }
  | {
      type: "replaceRelationLink";
      transaction: TxReplaceRelationLink;
    };

/**
 * The field `type` in each element refers to a method on GraphStore.
 * The field `transaction` refers to the transaction type.
 */
export type TxCombined = TxCombinedPart[];
