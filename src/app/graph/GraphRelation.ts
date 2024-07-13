import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { ItemWithPosition } from "@/app/graph/FractionalPositionedList";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { comparePositions, uuid } from "@/app/util";

import { GraphNode, PositionedRelation } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphStore, defaultRelationTypes } from "./GraphStore";

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
  private store: GraphStore;
  public id: string;
  public version: number;
  public createdAt: Date = new Date();
  public isPrivate: boolean = true;
  public relationType: GraphRelationType;
  public from: GraphObject;
  public to: GraphObject;

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
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      createdAt: observable,
      isPrivate: observable,
      relationType: observable.ref,
      from: observable.ref,
      to: observable.ref,
      text: computed,
      setType: action,
      setFrom: action,
      setTo: action,
      setTarget: action,
      setIsPrivate: action,
      incrementVersion: action,
    });
  }

  update(props: Partial<GraphRelationProps>) {
    const propsBefore: Partial<GraphRelationProps> = {};
    if (props.version && props.version !== this.version) {
      propsBefore.version = this.version;
      this.version = props.version;
    }
    if (props.from && props.from !== this.from) {
      propsBefore.from = this.from;
      this.setFrom(props.from);
    }
    if (props.to && props.to !== this.to) {
      propsBefore.to = this.to;
      this.setTo(props.to);
    }
    if (props.relationType && props.relationType !== this.relationType) {
      propsBefore.relationType = this.relationType;
      this.setType(props.relationType);
    }
    if (props.isPrivate !== undefined && props.isPrivate !== this.isPrivate) {
      propsBefore.isPrivate = this.isPrivate;
      this.setIsPrivate(props.isPrivate);
    }
    return propsBefore;
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
}
