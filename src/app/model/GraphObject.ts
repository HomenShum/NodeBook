import { PositionedRelation } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";

export interface GraphObject {
  id: string;
  type: "node" | "relation";
  createdAt: Date;
  isRoot: boolean;
  text: string;
  relations: GraphRelation[];
  relationsWithPositions: PositionedRelation[];
  relationsSortedByPosition: GraphRelation[];
  children: GraphObject[];
  pinChildRelation(relation: GraphRelation): void;
  unpinChildRelation(relation: GraphRelation): void;
  isRelationPinned(relation: GraphRelation): boolean;
}
