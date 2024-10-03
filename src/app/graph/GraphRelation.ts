import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, uuid } from "@/app/util";

import { BaseGraphObject, GraphObject } from "./GraphObject";
import { GraphStore } from "./GraphStore";

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
  isPublic?: boolean;
};

export type GraphRelationPropsWithoutTargets = {
  id?: string;
  relationTypeId?: GraphRelationType["id"];
  isPublic?: boolean;
};

export class GraphRelation extends BaseGraphObject implements Serializable {
  readonly objectType = "relation";
  id: string;
  authorId: string;
  version: number;
  createdAt: Date = new Date();
  isPublic: boolean = false;
  relationTypeId: string;
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
      isPublic = false,
    }: GraphRelationProps & { authorId: string },
  ) {
    super(store);

    this.version = version;
    this.id = id;
    this.authorId = authorId;
    this.from = from;
    this.to = to;
    this.relationTypeId = type.id;
    this.isPublic = isPublic;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      createdAt: observable,
      isPublic: observable,
      relationTypeId: observable,
      relationType: computed,
      from: observable.ref,
      to: observable.ref,
      text: computed,
      update: action,
      setType: action,
      setFrom: action,
      setTo: action,
      incrementVersion: action,
    });
  }

  update(props: Partial<GraphRelationProps>) {
    if (props.version) {
      this.version = props.version;
    } else {
      this.version++;
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
    if (props.isPublic !== undefined && props.isPublic !== this.isPublic) {
      this.isPublic = props.isPublic;
    }
  }

  get text(): string {
    return `[(${this.from.text}) -(${this.relationType.label})-> (${this.to.text})]`;
  }

  get searchText(): string {
    const fromText = this.from instanceof GraphRelation ? "" : this.from.searchText;
    const toText = this.to instanceof GraphRelation ? "" : this.to.searchText;
    return [this.relationType.label, this.relationType.reverseLabel, fromText, toText].join(" ");
  }

  get fromPosition(): Position | undefined {
    return this.from.allRelationsList.get(this.id)?.position;
  }

  get fromPinnedPosition(): Position | undefined {
    return this.from.pinnedRelationsList.get(this.id)?.position;
  }

  get toPosition(): Position | undefined {
    return this.to.allRelationsList.get(this.id)?.position;
  }

  get toPinnedPosition(): Position | undefined {
    return this.to.pinnedRelationsList.get(this.id)?.position;
  }

  get relationType(): GraphRelationType {
    return this.store.relationTypesById[this.relationTypeId];
  }

  setType(type: GraphRelationType) {
    this.relationTypeId = type.id;
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
      createdAt: this.createdAt,
      fromId: this.from.id,
      toId: this.to.id,
      relationTypeId: this.relationTypeId,
      isPublic: this.isPublic,
    };
  }
}
