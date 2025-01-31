import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";

import { DELETED_NODE_TEXT } from "@/app/graph/constants";
import { getOtherObject } from "@/app/graph/utils";
import { SerializedNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { comparePositions, Position, uuid } from "@/app/util";

import { BaseGraphObject } from "./BaseGraphObject";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";

export type Chip =
  | {
      type: "text" | "mention" | "linebreak";
      value: string;
    }
  | {
      type: "link";
      value: string;
      url: string;
    };

export type GraphNodeProps = {
  version?: number;
  id?: string;
  authorId?: string;
  content?: Chip[] | string;
  createdAt?: Date;
  updatedAt?: Date;
  isPublic?: boolean;
  isNewRelatedObjectsPublic?: boolean;
  isChecked?: boolean | null;
  canonicalRelation?: GraphRelation | null;
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode extends BaseGraphObject implements Serializable {
  readonly objectType = "node";
  version: number;
  id: string;
  authorId: string;
  content: Chip[] = [];
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean = true;
  isNewRelatedObjectsPublic: boolean;
  isChecked: boolean | null = null;

  constructor(
    store: GraphStore,
    {
      authorId,
      version = 1,
      id = uuid(),
      content = [],
      createdAt = new Date(),
      updatedAt = new Date(createdAt.getTime()),
      isPublic = false,
      isNewRelatedObjectsPublic = false,
      canonicalRelation = null,
      isChecked = null,
    }: GraphNodeProps & { authorId: string },
  ) {
    super(store);

    this.version = version;
    this.id = id;
    this.authorId = authorId;
    this.content =
      Array.isArray(content) && content.length > 0
        ? content
        : [{ type: "text", value: typeof content === "string" ? content : "" }];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.isPublic = isPublic;
    this.isNewRelatedObjectsPublic = isNewRelatedObjectsPublic;
    this.canonicalRelation = canonicalRelation;
    this.isChecked = isChecked;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      version: observable,
      createdAt: observable,
      updatedAt: observable,
      isPublic: observable,
      isNewRelatedObjectsPublic: observable,
      isChecked: observable,
      canonicalRelation: observable,
      content: observable.shallow,
      update: action,
      text: computed,
      relationsWithPositions: computed,
      contentOnlyAsText: computed,
    });
  }

  update(newProps: Partial<GraphNodeProps>) {
    const oldValues: Partial<GraphNodeProps> = {};
    if (newProps.content !== undefined) {
      oldValues.content = this.content;
      this.content =
        typeof newProps.content === "string" ? [{ type: "text", value: newProps.content }] : newProps.content;
    }
    if (newProps.isPublic !== undefined) {
      oldValues.isPublic = this.isPublic;
      this.isPublic = newProps.isPublic;
    }
    if (newProps.isNewRelatedObjectsPublic !== undefined) {
      oldValues.isNewRelatedObjectsPublic = this.isNewRelatedObjectsPublic;
      this.isNewRelatedObjectsPublic = newProps.isNewRelatedObjectsPublic;
    }
    if (newProps.isChecked !== undefined) {
      oldValues.isChecked = this.isChecked;
      this.isChecked = newProps.isChecked;
    }
    oldValues.version = this.version;
    if (newProps.version !== undefined) {
      this.version = newProps.version;
    } else {
      this.version++;
    }
    oldValues.updatedAt = this.updatedAt;
    if (newProps.updatedAt !== undefined) {
      this.updatedAt = newProps.updatedAt;
    } else {
      this.updatedAt = new Date();
    }
    if (newProps.canonicalRelation !== undefined) {
      oldValues.canonicalRelation = this.canonicalRelation;
      this.canonicalRelation = newProps.canonicalRelation;
    }

    return oldValues;
  }

  /**
   * Recursively traverses the node and its descendants to build a string
   * representation of the node's content.
   *
   * If `markupMentions` is true, mentions are wrapped in `@[...]`
   *
   * Todo: Since text is a getter property, we cannot pass
   * parameters to it. For now text property acts as a proxy
   * to _dfsText. Need to come up with a cleaner solution
   * without breaking things.
   */
  _dfsText(visitedMap: Record<string, boolean> = {}): string {
    visitedMap[this.id] = true;
    return this.content
      .map((chip) => {
        switch (chip.type) {
          case "text":
          case "linebreak":
          case "link":
            return chip.value;
          case "mention":
            const referencedNode = this.store.getNode(chip.value);
            if (!referencedNode) return `@[${DELETED_NODE_TEXT}]`;
            try {
              if (visitedMap[referencedNode.id]) {
                return "";
              } else {
                const text = referencedNode._dfsText(visitedMap);
                return `@[${text}]`;
              }
            } catch (error) {
              console.error("Error accessing referencedNode.text:", error);
              return "@[Error]";
            }
          default:
            chip satisfies never;
        }
      })
      .join("");
  }

  get contentOnlyAsText(): string {
    return this._dfsText({});
  }

  get text(): string {
    const text = this._dfsText({});
    if (this.noteContentRelationsList.size > 0) {
      return [
        text ? text + " - " : "",
        ...this.noteContentRelationsList
          .values()
          .sort((a, b) => comparePositions(a.position, b.position))
          .map(({ item }) => {
            const object = getOtherObject(item, this.id);
            if (object instanceof GraphNode) return object._dfsText({ [this.id]: true });
            if (object instanceof GraphRelation) return "[Relation]";
            return object ? object.text : "";
          })
          .filter((t) => t !== "")
          .join(" \\ "),
      ].join("");
    } else {
      return text;
    }
  }

  get searchText(): string {
    return this.text;
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  serialize(): SerializedNode {
    return {
      version: this.version,
      id: this.id,
      authorId: this.authorId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      content: toJS(this.content),
      isPublic: this.isPublic,
      isNewRelatedObjectsPublic: this.isNewRelatedObjectsPublic,
      canonicalRelationId: this.canonicalRelation?.id ?? null,
      isChecked: this.isChecked ?? null,
    };
  }
}
