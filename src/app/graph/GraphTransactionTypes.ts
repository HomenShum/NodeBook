import { GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationPropsWithoutTargets, GraphRelationType } from "./GraphRelation";

/**
 * Specifies a position in a list. Can be an index (number), the id of an object
 * in the list (string), or the object itself.
 */
export type Positioner<T extends { id: string }> = number | string | T;

export type RelationDirectionForObject = "from" | "to";

export type TxAddChildNode = {
  parentId: string;
  nodeProps?: GraphNodeProps;
  relationProps?: GraphRelationPropsWithoutTargets;
  after?: Positioner<GraphRelation>;
};

export type TxAddNode = GraphNodeProps;

export type TxRemoveNode = {
  nodeId: string;
};

export type TxAddRelation = {
  id?: string;
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

export type TxUpdateNode = {
  nodeId: string;
  nodeProps: Partial<GraphNodeProps>;
};

type TxMapping = {
  addChildNode: TxAddChildNode;
  removeNode: TxRemoveNode;
  addRelation: TxAddRelation;
  removeRelation: TxRemoveRelation;
  replaceRelationLink: TxReplaceRelationLink;
};

// TODO: probably can be done with less boilerplate code?
export type TxCombinedPart =
  | {
      type: "addNode";
      transaction: TxAddNode;
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
      type: "addChildNode";
      transaction: TxAddChildNode;
    }
  | {
      type: "replaceRelationLink";
      transaction: TxReplaceRelationLink;
    }
  | {
      type: "updateNode";
      transaction: TxUpdateNode;
    };

/**
 * The field `type` in each element refers to a method on GraphStore.
 * The field `transaction` refers to the transaction type.
 */
export type TxCombined = TxCombinedPart[];
