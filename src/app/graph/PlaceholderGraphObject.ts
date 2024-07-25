import { GraphObject } from "@/app/graph/GraphObject";

/**
 * Placeholder object used during deserialize to represent a reference to an object that has not yet been deserialized.
 *
 * Meant to only exist briefly during the deserialization processs. By design, will throw an error if any of its
 * properties are accessed.
 */
export class PlaceholderGraphObject extends GraphObject {
  id: string;
  authorId: string;
  createdAt: Date;
  public isPrivate: boolean = false;
  constructor(id: string, authorId: string) {
    super(null as any);
    this.id = id;
    this.authorId = authorId;
    this.createdAt = new Date();
  }
  objectType = "placeholder" as const;
  text = "PLACEHOLDER";
}
