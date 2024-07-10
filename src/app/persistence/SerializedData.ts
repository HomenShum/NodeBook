import { Chip } from "@/app/graph/GraphNode";
import { GraphRelation, GraphRelationType } from "@/app/graph/GraphRelation";
import { Serializable } from "@/app/persistence/serialization";
import { Position } from "@/app/util";

export type SerializedPositionList<T extends Serializable> = {
  [key: string]: Position;
};

export type SerializedGraphNode = {
  version: number;
  id: string;
  createdAt: Date;
  content: Chip[];
  isBundle: boolean;
  isZone: boolean;
  isPrivate: boolean;
};
export type SerializedRelation = {
  version: number;
  id: string;
  fromId: string;
  toId: string;
  relationTypeId: string;
  isPrivate: boolean;
};
type SerializedBundle = SerializedGraphNode;

type SerializedRelationsByNodeId = {
  [nodeId: string]: {
    [relationId: string]: Position;
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

export type SerializedTree = {
  id: string;
  rootObjectId: string;
  pathToRootIds: string[];
  expansionsByPath: Record<string, boolean>;
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

export type SerializedSyncData = {
  nodes?: SerializedGraphNode[];
  nodesDeleted?: SerializedGraphNode[];
  relations?: SerializedRelation[];
  relationsDeleted?: SerializedRelation[];
  relationTypes?: GraphRelationType[];
  relationTypesDeleted?: string[];
  relationLists?: Record<string, SerializedPositionList<GraphRelation>>;
  pinnedRelationLists?: Record<string, SerializedPositionList<GraphRelation>>;
};
