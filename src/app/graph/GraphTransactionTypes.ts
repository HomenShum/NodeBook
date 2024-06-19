import { GraphNodeProps } from "./GraphNode";
import { GraphRelationType } from "./GraphRelation";

export type RelationDirectionForObject = "from" | "to";

export type TxAddChildNode = {
  parentId: string;
  nodeProps?: GraphNodeProps;
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
