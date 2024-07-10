import { makeAutoObservable } from "mobx";

import { ItemWithPosition } from "@/app/graph/FractionalPositionedList";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { comparePositions, uuid } from "@/app/util";

import { GraphNode, PositionedRelation } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphStore, defaultRelationTypes } from "./GraphStore";
import { PlaceholderGraphObject, isPlaceholder } from "./PlaceholderGraphObject";

export type GraphRelationType = {
  version: number;
  id: string;
  label: string; // e.g. author
  reverseLabel: string; // e.g. authored by
};

export type GraphRelationProps = {
  version?: number;
  id?: string;
  from: GraphObject;
  to: GraphObject;
  relationType?: GraphRelationType;
  isPrivate?: boolean;
};

export type GraphRelationPropsWithoutTargets = {
  id?: string;
  relationTypeId?: GraphRelationType["id"];
  isPrivate?: boolean;
};

export type DeletedGraphRelationData = {
  relation: GraphRelation;
  fromPos: ItemWithPosition<GraphRelation> | undefined;
  fromPinnedPos: ItemWithPosition<GraphRelation> | undefined;
  toPos: ItemWithPosition<GraphRelation> | undefined;
  toPinnedPos: ItemWithPosition<GraphRelation> | undefined;
  bundles: GraphNode[];
};

export class GraphRelation implements Serializable, GraphObject {
  type = "relation" as const;
  private version: number;
  public id: string;
  public from: GraphObject;
  public to: GraphObject;
  public relationType: GraphRelationType;
  public createdAt: Date = new Date();
  private store: GraphStore;
  public isPrivate: boolean = true;

  constructor(
    store: GraphStore,
    {
      version = 1,
      id = uuid(),
      from,
      to,
      relationType: type = defaultRelationTypes.child,
      isPrivate = true,
    }: GraphRelationProps,
  ) {
    this.version = version;
    this.id = id;
    this.from = from;
    this.to = to;
    this.relationType = type;
    this.store = store;
    this.isPrivate = isPrivate;
    makeAutoObservable(this);
  }

  get text(): string {
    return `[(${this.from.text}) -(${this.relationType.label})-> (${this.to.text})]`;
  }

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
  }

  connectedObjects(): GraphObject[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  get isRoot(): boolean {
    return this.store.isRoot(this);
  }

  setType(type: GraphRelationType) {
    this.relationType = type;
  }

  setFrom(node: GraphObject, after?: Positioner<GraphRelation>) {
    // remove this relation from the current "from" node
    this.from.allRelationsList.delete(this.id);
    this.from.pinnedRelationsList.delete(this.id);
    // set the new "from" node
    this.from = node;
    // add this relation to the new "from" node
    this.from.allRelationsList.add(this, after);
    // TOOD: delete if no relations?
  }

  setTo(node: GraphObject, after?: Positioner<GraphRelation>) {
    // remove this relation from the current "to" node
    this.to.allRelationsList.delete(this.id);
    this.to.pinnedRelationsList.delete(this.id);
    // set the new "to" node
    this.to = node;
    // add this relation to the new "to" node
    this.to.allRelationsList.add(this, after);
    // TOOD: delete if no relations?
  }

  setTarget(target: "from" | "to", node: GraphObject, after?: Positioner<GraphRelation>) {
    if (target === "from") {
      this.setFrom(node, after);
    } else {
      this.setTo(node, after);
    }
  }

  setIsPrivate(value: boolean) {
    this.isPrivate = value;
  }

  updateType(newType: GraphRelationType) {
    this.store.updateRelationsType(this, newType);
  }

  incrementVersion() {
    this.version += 1;
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

  pinChildRelation(childRelation: GraphRelation | GraphRelation[], after?: number | string) {
    this.pinnedRelationsList.add(childRelation, after);
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.pinnedRelationsList.delete(childRelation.id);
  }

  isRelationPinned(childRelation: GraphRelation) {
    return this.pinnedRelationsList.has(childRelation.id);
  }

  serialize(): SerializedRelation {
    return {
      version: this.version,
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
    nullInsteadOfPlaceholder = false,
  ): GraphRelation | null {
    const from = getObjectById(data.fromId) ?? new PlaceholderGraphObject(data.fromId);
    const to = getObjectById(data.toId) ?? new PlaceholderGraphObject(data.toId);

    if (nullInsteadOfPlaceholder && (isPlaceholder(from) || isPlaceholder(to))) {
      return null;
    }

    const newRelation = new GraphRelation(store, {
      version: data.version,
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
}
