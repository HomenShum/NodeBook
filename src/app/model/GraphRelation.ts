import { makeAutoObservable } from "mobx";
import { comparePositions, uuid } from "../util";
import { GraphNode, PositionedRelation } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphStore, defaultRelationTypes } from "./GraphStore";
import { Serializable } from "./serialization";

export type GraphRelationType = {
  id: string;
  label: string;
  reverseLabel: string;
};

export type GraphRelationProps = {
  id?: string;
  from: GraphObject;
  to: GraphObject;
  relationType?: GraphRelationType;
};

export class GraphRelation implements Serializable, GraphObject {
  type = "relation" as const;
  public id: string;
  public from: GraphObject;
  public to: GraphObject;
  public relationType: GraphRelationType;
  public createdAt: Date = new Date();
  private store: GraphStore;

  constructor(
    store: GraphStore,
    { id = uuid(), from, to, relationType: type = defaultRelationTypes.child }: GraphRelationProps,
  ) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.relationType = type;
    this.store = store;
    makeAutoObservable(this);
  }

  get text(): string {
    return `(${this.from.id}) -[${this.id}: ${this.relationType.label}]-> (${this.to.id})`;
  }

  get children(): GraphObject[] {
    return this.relations
      .filter((r) => r.relationType.id === this.store.relationTypesById.child.id && r.from === this)
      .map((r) => r.to);
  }

  get isRoot(): boolean {
    return this.store.isRoot(this);
  }

  setType(type: GraphRelationType) {
    this.relationType = type;
  }

  setFrom(node: GraphObject) {
    this.from = node;
  }

  setTo(node: GraphObject) {
    this.to = node;
  }

  delete() {
    this.store.deleteRelation(this);
  }

  updateType(newType: GraphRelationType) {
    this.store.updateRelationsType(this, newType);
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

  get relationsWithPositions(): PositionedRelation[] {
    const list = this.store.relationsByNodeId.get(this.id);
    if (!list) return [];
    return list.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get relations(): GraphRelation[] {
    return this.relationsWithPositions.map(({ relation }) => relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return this.relationsWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ relation }) => relation);
  }

  pinChildRelation(childRelation: GraphRelation) {
    this.store.createPinnedVersionOfRelation(childRelation, this.id === childRelation.from.id ? "from" : "to");
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.store.deletePinnedVersionOfRelation(childRelation, this.id === childRelation.from.id ? "from" : "to");
  }

  isRelationPinned(childRelation: GraphRelation) {
    return (
      this.store.correspondingPinnedForObjects.has(childRelation.id) || this.pinnedRelationsList.has(childRelation.id)
    );
  }

  serialize() {
    return {
      id: this.id,
      fromId: this.from.id,
      toId: this.to.id,
      relationType: this.relationType,
    };
  }

  static deserialize(
    data: ReturnType<GraphRelation["serialize"]>,
    store: GraphStore,
    nodesById: Map<string, GraphNode>,
  ): GraphRelation {
    return new GraphRelation(store, {
      id: data.id,
      from: nodesById.get(data.fromId)!,
      to: nodesById.get(data.toId)!,
      relationType: data.relationType,
    });
  }
}
