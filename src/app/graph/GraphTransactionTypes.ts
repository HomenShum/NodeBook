import { GraphRelationType } from "@/app/graph/types";
import { GroupId } from "@/app/tree/nodes";

import { GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationPropsWithoutTargets } from "./GraphRelation";

/**
 * Specifies a position in a list. Can be an index (number), the id of an object
 * in the list (string), or the object itself.
 */
export type Positioner<T extends { id: string }> = number | string | T;

export type RelationDirectionForObject = "from" | "to";
export type TxAddNode = {
  nodeProps?: GraphNodeProps;
};

export type TxRemoveNode = {
  nodeId: string;
};

export type TxUpdateNode = {
  nodeId: string;
  nodeProps: Partial<GraphNodeProps>;
};

export type TxAddRelation = {
  id?: string;
  fromId: string;
  toId: string;
  relationType?: GraphRelationType;
  after?: Positioner<GraphRelation>;
};

export type TxRemoveRelation = {
  relationId: string;
};

export type TxReplaceRelationLink = {
  direction: RelationDirectionForObject;
  relationId: string;
  replaceWith: { type: "new-node"; nodeProps?: GraphNodeProps } | { type: "existing-object"; id: string };
  after?: Positioner<GraphRelation>;
};

export type TxUpdateRelation = {
  relationId: string;
  relationProps?: {
    isPublic?: boolean;
    relationType?: GraphRelationType;
    relationTypeLabel?: string;
    isInitiallyReversed?: boolean;
  };
  reverse?: boolean;
};

export type TxAddRelationType = {
  id?: string;
  label: string;
  reverseLabel?: string;
};

export type TxAddChildNode = {
  parentId: string;
  nodeProps?: GraphNodeProps;
  relationProps?: GraphRelationPropsWithoutTargets;
  after?: Positioner<GraphRelation>;
};

export type TxUpdateRelationPositionsList = {
  containingNodeId: string;
  groupId: GroupId;
  objectAndRelationIds: { objectId: string; relationId: string }[];
  afterObjectId?: string;
};

export type TxSetIsPublic = {
  objectId: string;
  relationId?: string;
  isPublic: boolean;
  alsoSetRelatedObjects: boolean;
  alsoSetChildrenAndDescendants: boolean;
};

export type TxPinRelation = {
  objectId: string;
  relationId: string;
  after?: Positioner<GraphRelation>;
};

export type TxUnpinRelation = {
  objectId: string;
  relationId: string;
};

// TODO: probably can be done with less boilerplate code?
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
      type: "updateNode";
      transaction: TxUpdateNode;
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
    }
  | {
      type: "updateRelation";
      transaction: TxUpdateRelation;
    }
  | {
      type: "addRelationType";
      transaction: TxAddRelationType;
    }
  | {
      type: "addChildNode";
      transaction: TxAddChildNode;
    }
  | {
      type: "updateRelationPositionsList";
      transaction: TxUpdateRelationPositionsList;
    }
  | {
      type: "setIsPublic";
      transaction: TxSetIsPublic;
    }
  | {
      type: "pinRelation";
      transaction: TxPinRelation;
    }
  | {
      type: "unpinRelation";
      transaction: TxUnpinRelation;
    };
/**
 * The field `type` in each element refers to a method on GraphStore.
 * The field `transaction` refers to the transaction type.
 */
export type TxCombined = TxCombinedPart[];
