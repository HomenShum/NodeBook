import { Chip } from "@/app/graph/GraphNode";
import { GraphRelationType } from "@/app/graph/GraphRelation";
import { Position } from "@/app/util";

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
  relationToBundles?: Record<string, SerializedBundle[]>;
};

type SerializedPathData = { isExpanded: boolean; isPinnedExpanded: boolean };

export type SerializedTree = {
  root: string;
  pathData?: Record<string, SerializedPathData>;
};

export type SerializedViewStore = {
  mainStreamView: SerializedTree;
  mainOutlineView: SerializedTree;
  sidebarOutlineViews: SerializedTree[];
};

export type SerializedStores = {
  graphStore: SerializedGraphStore;
  viewStore: SerializedViewStore;
};
