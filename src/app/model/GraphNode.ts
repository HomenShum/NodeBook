import { makeAutoObservable } from "mobx";
import { Position, comparePositions, uuid } from "../util";
import { GraphObject } from "./GraphObject";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { Serializable } from "./serialization";

export type Chip = {
  type: "text" | "mention";
  value: string;
};

export type GraphNodeProps = { id?: string; content?: Chip[]; createdAt?: Date; isBundle?: boolean };

export type RelativePositionProps = {
  target?: GraphRelation;
  side?: "above" | "below";
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode implements Serializable, GraphObject {
  id: string;
  content: Chip[] = [];
  createdAt: Date;
  type = "node" as const;
  isBundle: boolean;

  constructor(
    private store: GraphStore,
    { id = uuid(), content = [], createdAt = new Date(), isBundle = false }: GraphNodeProps,
  ) {
    this.id = id;
    this.content = content;
    this.createdAt = createdAt;
    this.isBundle = isBundle;
    makeAutoObservable(this);
  }

  toggleBundle() {
    this.isBundle = !this.isBundle;
  }

  setIsBundle(isBundle: boolean) {
    this.isBundle = isBundle;
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

  setContent(newContent: Chip[]) {
    this.content = newContent;
  }

  get text(): string {
    return this.content
      .map((chip) => {
        return chip.type == "mention" ? this.store.getNode(chip.value)?.text || "[Deleted node]" : chip.value;
      })
      .join();
  }

  get children(): GraphObject[] {
    return this.relations
      .filter((r) => r.relationType.id === this.store.relationTypesById.child.id && r.from === this)
      .map((r) => r.to);
  }

  pinChildRelation(childRelation: GraphRelation) {
    this.store.createPinnedVersionOfRelation(childRelation, this.id === childRelation.from.id ? "from" : "to");
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.store.unpinRelation(childRelation, this.id === childRelation.from.id ? "from" : "to");
  }

  isRelationPinned(childRelation: GraphRelation) {
    const correspondingRelation = this.store.getCorrespondingRelation(childRelation);
    if (!correspondingRelation) return false;

    return this.pinnedRelationsList.has(childRelation.id) || this.pinnedRelationsList.has(correspondingRelation.id);
  }

  delete() {
    this.store.deleteNode(this.id);
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  private assertValidRelation(relation: GraphRelation) {
    if (relation.from.id !== this.id && relation.to.id !== this.id) {
      throw new Error(`Relation ${relation} does not involve node ${this}`);
    }
  }

  serialize() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      content: this.content,
      isBundle: this.isBundle,
    };
  }

  static deserialize(data: ReturnType<GraphNode["serialize"]>, store: GraphStore): GraphNode {
    return new GraphNode(store, {
      id: data.id,
      content: data.content,
      createdAt: new Date(data.createdAt),
      isBundle: data.isBundle,
    });
  }
}
