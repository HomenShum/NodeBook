import { makeAutoObservable } from "mobx";
import { Position, comparePositions, uuid } from "../util";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { Serializable } from "./serialization";

export type Chip = {
  type: "text" | "mention";
  value: string;
};

export type GraphNodeProps = { id?: string; content?: Chip[]; createdAt?: Date; type?: GraphNodeType };

export type RelativePositionProps = {
  target?: GraphRelation;
  side?: "above" | "below";
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export type GraphNodeType = "bullet" | "bundle";

export class GraphNode implements Serializable {
  id: string;
  content: Chip[];
  createdAt: Date;
  type: GraphNodeType;

  constructor(
    private store: GraphStore,
    { id = uuid(), content = [], createdAt = new Date(), type = "bullet" }: GraphNodeProps,
  ) {
    this.id = id;
    this.content = content;
    this.createdAt = createdAt;
    this.type = type;
    makeAutoObservable(this);
  }

  setType(type: GraphNodeType) {
    this.type = type;
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

  get isRoot() {
    return (
      this.id === this.store.outlineRoot.id ||
      this.id === this.store.thoughtstreamRoot.id ||
      this.id === this.store.userRoot.id
    );
  }

  get relations(): GraphRelation[] {
    return this.allRelationsList.values().map(({ item }) => item);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return Array.from(this.allRelationsList.values())
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ item }) => item);
  }

  get relationsWithPositions(): PositionedRelation[] {
    return this.allRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
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

  createChild(props: GraphNodeProps = {}) {
    return this.store.createChildNode(this, props);
  }

  delete() {
    this.store.deleteNode(this.id);
  }

  get children(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypesById.child.id && r.from === this)
      .map((r) => r.to);
  }

  get parents(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypesById.child.id && r.to === this)
      .map((r) => r.from);
  }

  get relatedNodes(): GraphNode[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  pinChildRelation(childRelation: GraphRelation) {
    if (!this.allRelationsList.get(childRelation.id)) {
      console.error("Can't pin relation that doesn't involve this node");
      return;
    }
    this.pinnedRelationsList.add(childRelation);
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

  serialize() {
    return {
      id: this.id,
      type: this.type,
      createdAt: this.createdAt,
      content: this.content,
    };
  }

  static deserialize(data: ReturnType<GraphNode["serialize"]>, store: GraphStore): GraphNode {
    return new GraphNode(store, {
      id: data.id,
      type: data.type,
      content: data.content,
      createdAt: new Date(data.createdAt),
    });
  }
}
