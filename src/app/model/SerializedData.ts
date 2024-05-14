import { Position } from "../util";
import { Chip } from "./GraphNode";
import { GraphRelationType } from "./GraphRelation";
import { PathData } from "./GraphStore";

export type SerializedGraphNode = {
  id: string;
  createdAt: Date;
  content: Chip[];
  isBundle: boolean;
  isZone: boolean;
  isPrivate: boolean;
};
export type SerializedRelation = {
  id: string;
  fromId: string;
  toId: string;
  relationTypeId: string;
  isPrivate: boolean;
};
type SerializedBundle = SerializedGraphNode;

type SerializedRelationsByNodeId = {
  [nodeId: string]: {
    [relationId: string]: {
      item: SerializedRelation;
      position: Position;
    };
  };
};

export type SerializedGraphStore = {
  nodesById: Record<string, SerializedGraphNode>;
  relationTypesById: Record<string, GraphRelationType>;
  relationsById: Record<string, SerializedRelation>;
  relationsByNodeId: SerializedRelationsByNodeId;
  pinnedRelationsByNodeId: SerializedRelationsByNodeId;
  pathData?: Record<string, PathData>;
  relationToBundles?: Record<string, SerializedBundle[]>;
  correspondingObjectsForPinned?: Record<string, SerializedRelation>;
  correspondingPinnedForObjects?: Record<string, SerializedRelation>;
};
