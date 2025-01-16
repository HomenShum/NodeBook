import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, uuid } from "@/app/util";

import { BaseGraphObject } from "./BaseGraphObject";
import { GraphObject } from "./GraphObject";
import { GraphStore } from "./GraphStore";

export function isGraphRelationType(obj: any): obj is GraphRelationType {
  return (
    typeof obj === "object" &&
    obj.hasOwnProperty("id") &&
    obj.hasOwnProperty("label") &&
    obj.hasOwnProperty("reverseLabel")
  );
}

export type GraphRelationProps = {
  version?: number;
  id?: string;
  authorId?: string;
  from: GraphObject;
  to: GraphObject;
  relationType?: GraphRelationType;
  isPublic?: boolean;
  updatedAt?: Date;
  canonicalRelation?: GraphRelation | null;
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
  updatedAt: Date = new Date(this.createdAt.getTime());
  isPublic: boolean = false;
  relationTypeId: string;
  from: GraphObject;
  to: GraphObject;
  canonicalRelation: GraphRelation | null = null;

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
      updatedAt: observable,
      isPublic: observable,
      relationTypeId: observable,
      relationType: computed,
      from: observable.ref,
      to: observable.ref,
      canonicalRelation: observable,
      text: computed,
      update: action,
      incrementVersion: action,
    });
  }

  update(props: Partial<GraphRelationProps>) {
    if (props.version) {
      this.version = props.version;
    } else {
      this.version++;
    }
    if (props.updatedAt) {
      this.updatedAt = props.updatedAt;
    } else {
      this.updatedAt = new Date();
    }
    if (props.from && props.to && this.from.id === props.to.id && this.to.id === props.from.id) {
      this.from = props.from;
      this.to = props.to;
    } else {
      if (props.from && props.from !== this.from) {
        this.from = props.from;
      }
      if (props.to && props.to !== this.to) {
        this.to = props.to;
      }
    }
    if (props.relationType && props.relationType !== this.relationType) {
      this.relationTypeId = props.relationType.id;
    }
    if (props.isPublic !== undefined && props.isPublic !== this.isPublic) {
      this.isPublic = props.isPublic;
    }
    if (props.canonicalRelation !== undefined) {
      this.canonicalRelation = props.canonicalRelation;
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

  get toNoteContentPosition(): Position | undefined {
    return this.to.noteContentRelationsList.get(this.id)?.position;
  }

  get fromNoteContentPosition(): Position | undefined {
    return this.from.noteContentRelationsList.get(this.id)?.position;
  }

  get relationType(): GraphRelationType {
    return this.store.relationTypesById[this.relationTypeId];
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
      updatedAt: this.updatedAt,
      fromId: this.from.id,
      toId: this.to.id,
      relationTypeId: this.relationTypeId,
      isPublic: this.isPublic,
      canonicalRelationId: this.canonicalRelation?.id ?? null,
    };
  }
}
