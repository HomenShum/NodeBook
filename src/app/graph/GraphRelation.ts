import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { uuid } from "@/app/util";

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

export class GraphRelation extends GraphObject implements Serializable {
  objectType: "relation" = "relation";
  id: string;
  version: number;
  createdAt: Date = new Date();
  isPrivate: boolean = true;
  relationType: GraphRelationType;
  from: GraphObject;
  to: GraphObject;

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
    super(store);
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

  isLabelled() {
    return this.relationType.id !== defaultRelationTypes.child.id;
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
