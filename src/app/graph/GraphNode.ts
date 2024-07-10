import { makeAutoObservable, toJS } from "mobx";

import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SerializedGraphNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, comparePositions, uuid } from "@/app/util";

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

export class GraphNode implements Serializable, GraphObject {
  version: number;
  id: string;
  content: Chip[] = [];
  createdAt: Date;
  type = "node" as const;
  isBundle: boolean;
  isZone: boolean;
  public isPrivate: boolean = true;

  constructor(
    private store: GraphStore,
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
    makeAutoObservable(this);
  }

  setIsPrivate(value: boolean) {
    this.isPrivate = value;
  }

  get allRelationsList() {
    const list = this.store.relationsByNodeId.get(this.id);
    if (!list) throw new Error("Missing allRelationsList");
    return list;
  }

  get pinnedRelationsList() {
    const list = this.store.pinnedRelationsByNodeId.get(this.id);
    if (!list) throw new Error("Missing pinnedRelationsList");
    return list;
  }

  get isRoot(): boolean {
    return this.store.isRoot(this);
  }

  get relationsWithPositions(): PositionedRelation[] {
    const list = this.store.relationsByNodeId.get(this.id);
    if (!list) return [];
    return list.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get relations(): GraphRelation[] {
    return this.relationsWithPositions.map(({ relation }) => relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return this.relationsWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ relation }) => relation);
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
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

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
  }

  connectedObjects(): GraphObject[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  pinChildRelation(childRelation: GraphRelation | GraphRelation[], after?: Positioner<GraphRelation>) {
    this.pinnedRelationsList.add(childRelation, after);
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.pinnedRelationsList.delete(childRelation.id);
  }

  isRelationPinned(childRelation: GraphRelation) {
    return this.pinnedRelationsList.has(childRelation.id);
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  private assertValidRelation(relation: GraphRelation) {
    if (relation.from.id !== this.id && relation.to.id !== this.id) {
      throw new Error(`Relation ${relation} does not involve node ${this}`);
    }
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

  serialize(): SerializedGraphNode {
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

  static deserialize(data: SerializedGraphNode, store: GraphStore): GraphNode {
    return new GraphNode(store, {
      version: data.version,
      id: data.id,
      content: data.content,
      createdAt: new Date(data.createdAt),
      isBundle: data.isBundle,
      isZone: data.isZone,
      isPrivate: data.isPrivate,
    });
  }
}
