import { BaseGraphObject } from "@/app/graph/GraphObject";
import { GraphStore } from "@/app/graph/GraphStore";

/**
 * Placeholder object used during deserialize to represent a reference to an object that has not yet been deserialized.
 *
 * Meant to only exist briefly during the deserialization processs. By design, will throw an error if any of its
 * properties are accessed.
 */
export class PlaceholderGraphObject extends BaseGraphObject {
  readonly objectType = "placeholder";
  id: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  public isPublic: boolean = false;
  constructor(store: GraphStore, id: string, authorId: string) {
    super(store);
    this.id = id;
    this.authorId = authorId;
    this.createdAt = new Date();
    this.updatedAt = new Date(this.createdAt.getTime());
  }
  text = "PLACEHOLDER";
  searchText = "PLACEHOLDER";
}
