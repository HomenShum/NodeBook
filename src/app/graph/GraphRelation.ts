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
  authorId: string;
  label: string; // e.g. author
  reverseLabel: string; // e.g. authored by
};

export function isGraphRelationType(obj: any): obj is GraphRelationType {
  return obj && obj.id && obj.label && obj.reverseLabel;
}

export type GraphRelationProps = {
  version?: number;
  id?: string;
  authorId?: string;
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
  authorId: string;
  version: number;
  createdAt: Date = new Date();
  isPrivate: boolean = true;
  relationType: GraphRelationType;
  from: GraphObject;
  to: GraphObject;

  constructor(
    store: GraphStore,
    {
      authorId,
      version = 1,
      id = uuid(),
      from,
      to,
      relationType: type = defaultRelationTypes.child,
      isPrivate = true,
    }: GraphRelationProps & { authorId: string },
  ) {
    super(store);

    this.version = version;
    this.id = id;
    this.authorId = authorId;
    this.from = from;
    this.to = to;
    this.relationType = type;
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
      update: action,
      setType: action,
      setFrom: action,
      setTo: action,
      setIsPrivate: action,
      incrementVersion: action,
    });
  }

  update(props: Partial<GraphRelationProps>) {
    if (props.version && props.version !== this.version) {
      this.version = props.version;
    }
    if (props.from && props.to && this.from.id === props.to.id && this.to.id === props.from.id) {
      const newFromPosition = this.to.relationsSortedByPosition.findIndex((r) => r.id === this.id);
      const newToPosition = this.from.relationsSortedByPosition.findIndex((r) => r.id === this.id) - 1;
      this.setFrom(props.from, newFromPosition);
      this.setTo(props.to, newToPosition);
    }
    if (props.from && props.from !== this.from) {
      this.setFrom(props.from);
    }
    if (props.to && props.to !== this.to) {
      this.setTo(props.to);
    }
    if (props.relationType && props.relationType !== this.relationType) {
      this.setType(props.relationType);
    }
    if (props.isPrivate !== undefined && props.isPrivate !== this.isPrivate) {
      this.setIsPrivate(props.isPrivate);
    }
  }

  get text(): string {
    return `[(${this.from.text}) -(${this.relationType.label})-> (${this.to.text})]`;
  }

  get searchText(): string {
    return [this.from.searchText, this.relationType.label, this.relationType.reverseLabel, this.to.searchText].join(
      " ",
    );
  }

  setType(type: GraphRelationType) {
    this.relationType = type;
  }

  setFrom(node: GraphObject, after?: Positioner<GraphRelation>) {
    // remove this relation from the current "from" node's relation list, unless it's a circular relation
    if (this.to.id != this.from.id) {
      this.from.allRelationsList.delete(this.id);
      this.from.pinnedRelationsList.delete(this.id);
    }
    // set the new "from" node
    this.from = node;
    // add this relation to the new "from" node
    this.from.allRelationsList.add(this, after);
  }

  setTo(node: GraphObject, after?: Positioner<GraphRelation>) {
    // remove this relation from the current "to" node's relation list, unless it's a circular relation
    if (this.to.id != this.from.id) {
      this.to.allRelationsList.delete(this.id);
      this.to.pinnedRelationsList.delete(this.id);
    }
    // set the new "to" node
    this.to = node;
    // add this relation to the new "to" node
    this.to.allRelationsList.add(this, after);
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
      authorId: this.authorId,
      fromId: this.from.id,
      toId: this.to.id,
      relationTypeId: this.relationType.id,
      isPrivate: this.isPrivate,
    };
  }
}
