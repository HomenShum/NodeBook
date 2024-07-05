import { FractionalPositionedList } from "@/app/graph/FractionalPositionedList";

import { PositionedRelation } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation } from "./GraphRelation";

/**
 * Placeholder object used during deserialize to represent a reference to an object that has not yet been deserialized.
 *
 * Meant to only exist briefly during the deserialization processs. By design, will throw an error if any of its
 * properties are accessed.
 */
export class PlaceholderGraphObject implements GraphObject {
  id: string;
  createdAt: Date;
  constructor(id: string) {
    this.id = id;
    this.createdAt = new Date();
  }

  type = "placeholder" as const;
  text = "PLACEHOLDER";

  get isRoot(): boolean {
    throw new Error("Method not implemented.");
  }
  get children(): GraphObject[] {
    throw new Error("Method not implemented.");
  }
  connectedObjects(): GraphObject[] {
    throw new Error("Method not implemented.");
  }
  get relations(): GraphRelation[] {
    throw new Error("Method not implemented.");
  }
  get relationsWithPositions(): PositionedRelation[] {
    throw new Error("Method not implemented.");
  }
  get relationsSortedByPosition(): GraphRelation[] {
    throw new Error("Method not implemented.");
  }
  get isPrivate(): boolean {
    throw new Error("Method not implemented.");
  }
  get pinnedRelationsWithPositions(): PositionedRelation[] {
    throw new Error("Method not implemented.");
  }
  setIsPrivate(value: boolean): void {
    throw new Error("Method not implemented.");
  }
  pinChildRelation(relation: GraphRelation): void {
    throw new Error("Method not implemented.");
  }
  unpinChildRelation(relation: GraphRelation): void {
    throw new Error("Method not implemented.");
  }
  isRelationPinned(relation: GraphRelation): boolean {
    throw new Error("Method not implemented.");
  }
  get allRelationsList(): FractionalPositionedList<GraphRelation> {
    throw new Error("Method not implemented.");
  }
  get pinnedRelationsList(): FractionalPositionedList<GraphRelation> {
    throw new Error("Method not implemented.");
  }
}

export const isPlaceholder = (obj: GraphObject): obj is PlaceholderGraphObject => obj.type === "placeholder";
