import { PositionedRelation } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";

export interface GraphObject {
  id: string;
  type: "node" | "relation" | "placeholder";
  createdAt: Date;
  isRoot: boolean;
  text: string;
  relations: GraphRelation[];
  relationsWithPositions: PositionedRelation[];
  relationsSortedByPosition: GraphRelation[];
  children: GraphObject[];
  connectedObjects(): GraphObject[];
  isPrivate: boolean;
  setIsPrivate(value: boolean): void;

  // pinned objects
  pinnedRelationsWithPositions: PositionedRelation[];
  pinChildRelation(relation: GraphRelation): void;
  unpinChildRelation(relation: GraphRelation): void;
  isRelationPinned(relation: GraphRelation): boolean;
}
