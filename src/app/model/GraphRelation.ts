import { makeAutoObservable } from "mobx";
import { comparePositions, uuid } from "../util";
import { PositionedRelation } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphStore, defaultRelationTypes } from "./GraphStore";
import { PlaceholderGraphObject, isPlaceholder } from "./PlaceholderGraphObject";
import { SerializedRelation } from "./SerializedData";
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
  isPrivate?: boolean;
};

export class GraphRelation implements Serializable, GraphObject {
  type = "relation" as const;
  public id: string;
  public from: GraphObject;
  public to: GraphObject;
  public relationType: GraphRelationType;
  public createdAt: Date = new Date();
  private store: GraphStore;
  public isPrivate: boolean = true;

  constructor(
    store: GraphStore,
    { id = uuid(), from, to, relationType: type = defaultRelationTypes.child, isPrivate = true }: GraphRelationProps,
  ) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.relationType = type;
    this.store = store;
    this.isPrivate = isPrivate;
    makeAutoObservable(this);
  }

  get text(): string {
    return `[(${this.from.text}) -(${this.id}: ${this.relationType.label})-> (${this.to.text})]`;
  }

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
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

  setIsPrivate(value: boolean) {
    this.isPrivate = value;
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
    this.store.unpinRelation(childRelation, this.id === childRelation.from.id ? "from" : "to");
  }

  isRelationPinned(childRelation: GraphRelation) {
    const correspondingRelation = this.store.getCorrespondingRelation(childRelation);
    if (!correspondingRelation) return false;

    return this.pinnedRelationsList.has(childRelation.id) || this.pinnedRelationsList.has(correspondingRelation.id);
  }

  serialize(): SerializedRelation {
    return {
      id: this.id,
      fromId: this.from.id,
      toId: this.to.id,
      relationTypeId: this.relationType.id,
      isPrivate: this.isPrivate,
    };
  }

  static deserialize(
    data: SerializedRelation,
    store: GraphStore,
    getObjectById: (id: string) => GraphObject | undefined,
    getRelationTypeById: (id: string) => GraphRelationType | undefined,
  ): GraphRelation {
    const from = getObjectById(data.fromId) ?? new PlaceholderGraphObject(data.fromId);
    const to = getObjectById(data.toId) ?? new PlaceholderGraphObject(data.toId);
    const newRelation = new GraphRelation(store, {
      id: data.id,
      from,
      to,
      relationType: getRelationTypeById(data.relationTypeId),
      isPrivate: data?.isPrivate ?? true,
    });
    if (from instanceof GraphRelation && isPlaceholder(from.to) && from.to.id === data.id) {
      from.setTo(newRelation);
    }
    if (to instanceof GraphRelation && isPlaceholder(to.from) && to.from.id === data.id) {
      to.setFrom(newRelation);
    }
    return newRelation;
  }

  get multipleNonStreamRelationsToThis() {
    return (
      this.relations.filter((r) => r.to.id === this.id && r.from.id !== this.store.thoughtstreamRoot.id).length > 1
    );
  }
}
