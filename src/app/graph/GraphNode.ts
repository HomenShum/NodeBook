import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";

import { SerializedNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { ObjectPath, Position, uuid } from "@/app/util";

import { GraphObject } from "./GraphObject";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";

export type Chip = {
  type: "text" | "mention" | "linebreak";
  value: string;
};

export type GraphNodeProps = {
  version?: number;
  id?: string;
  authorId?: string;
  content?: Chip[] | string;
  createdAt?: Date;
  isBundle?: boolean;
  isZone?: boolean;
  isPublic?: boolean;
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode extends GraphObject implements Serializable {
  objectType = "node" as const;
  version: number;
  id: string;
  authorId: string;
  content: Chip[] = [];
  createdAt: Date;
  isBundle: boolean;
  isZone: boolean;
  isPublic: boolean = true;

  constructor(
    store: GraphStore,
    {
      authorId,
      version = 1,
      id = uuid(),
      content = [],
      createdAt = new Date(),
      isBundle = false,
      isZone = false,
      isPublic = false,
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
    this.isBundle = isBundle;
    this.isZone = isZone;
    this.isPublic = isPublic;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      version: observable,
      createdAt: observable,
      isBundle: observable,
      isZone: observable,
      isPublic: observable,
      content: observable.shallow,
      update: action,
      text: computed,
      isLocal: computed,
      relationsWithPositions: computed,
    });
  }

  update(newProps: Partial<GraphNodeProps>) {
    const oldValues: Partial<GraphNodeProps> = {};
    if (newProps.content !== undefined) {
      oldValues.content = this.content;
      this.content =
        typeof newProps.content === "string" ? [{ type: "text", value: newProps.content }] : newProps.content;
    }
    if (newProps.isBundle !== undefined) {
      oldValues.isBundle = this.isBundle;
      this.isBundle = newProps.isBundle;
    }
    if (newProps.isZone !== undefined) {
      oldValues.isZone = this.isZone;
      this.isZone = newProps.isZone;
    }
    if (newProps.isPublic !== undefined) {
      oldValues.isPublic = this.isPublic;
      this.isPublic = newProps.isPublic;
    }
    oldValues.version = this.version;
    if (newProps.version !== undefined) {
      this.version = newProps.version;
    } else {
      this.version++;
    }

    return oldValues;
  }

  get text(): string {
    return this.content
      .map((chip) => {
        switch (chip.type) {
          case "text":
          case "linebreak":
            return chip.value;
          case "mention":
            const referencedNode = this.store.getNode(chip.value);
            if (!referencedNode) return "[Deleted node]";
            try {
              return `@[${referencedNode.text}]`;
            } catch (error) {
              console.error("Error accessing referencedNode.text:", error);
              return "@[Error]";
            }
        }
      })
      .join("");
  }

  get searchText(): string {
    return this.text;
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  getPath({ limit = 10 }: { limit?: number } = {}): ObjectPath {
    const relations: GraphRelation[] = [];
    let current: GraphObject | undefined = this;

    for (let i = 0; i < limit && current && current !== this.store.userRoot; i++) {
      const parentRelation: GraphRelation | undefined = current.relationsSortedByPosition.find(
        (r) => r.relationType.id === "child" && r.to === current,
      );
      if (!parentRelation || relations.some((p) => p.id === parentRelation.id)) {
        return { relations, object: this };
      }
      relations.unshift(parentRelation);
      current = parentRelation.from;
    }
    return { relations, object: this };
  }

  serialize(): SerializedNode {
    return {
      version: this.version,
      id: this.id,
      authorId: this.authorId,
      createdAt: this.createdAt,
      content: toJS(this.content),
      isBundle: this.isBundle,
      isZone: this.isZone,
      isPublic: this.isPublic,
    };
  }
}
