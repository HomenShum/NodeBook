import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";

import { SerializedNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, uuid } from "@/app/util";

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
  content?: Chip[] | string;
  createdAt?: Date;
  isBundle?: boolean;
  isZone?: boolean;
  isPrivate?: boolean;
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode extends GraphObject implements Serializable {
  objectType = "node" as const;
  version: number;
  id: string;
  content: Chip[] = [];
  createdAt: Date;
  isBundle: boolean;
  isZone: boolean;
  public isPrivate: boolean = true;

  constructor(
    store: GraphStore,
    {
      version = 1,
      id = uuid(),
      content = [],
      createdAt = new Date(),
      isBundle = false,
      isZone = false,
      isPrivate = true,
    }: GraphNodeProps,
  ) {
    super(store);
    this.version = version;
    this.id = id;
    this.content =
      Array.isArray(content) && content.length > 0
        ? content
        : [{ type: "text", value: typeof content === "string" ? content : "" }];
    this.createdAt = createdAt;
    this.isBundle = isBundle;
    this.isZone = isZone;
    this.isPrivate = isPrivate;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      version: observable,
      createdAt: observable,
      isBundle: observable,
      isZone: observable,
      isPrivate: observable,
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
    if (newProps.isPrivate !== undefined) {
      oldValues.isPrivate = this.isPrivate;
      this.isPrivate = newProps.isPrivate;
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
            return `@[${referencedNode.text}]`;
        }
      })
      .join("");
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  getPath({ limit = 10 }: { limit?: number } = {}): GraphRelation[] {
    const path: GraphRelation[] = [];
    let current: GraphObject | undefined = this;

    for (let i = 0; i < limit && current; i++) {
      const parentRelation: GraphRelation | undefined = current.relationsSortedByPosition.find(
        (r) => r.relationType.id === "child" && r.to === current && r.from.id !== this.store.thoughtstreamRoot.id,
      );
      if (!parentRelation || path.some((p) => p.id === parentRelation.id)) {
        return path;
      }
      path.unshift(parentRelation);
      current = parentRelation.from;
    }
    return path;
  }

  serialize(): SerializedNode {
    return {
      version: this.version,
      id: this.id,
      createdAt: this.createdAt,
      content: toJS(this.content),
      isBundle: this.isBundle,
      isZone: this.isZone,
      isPrivate: this.isPrivate,
    };
  }
}
