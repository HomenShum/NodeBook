import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { SerializedRelation } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, uuid } from "@/app/util";
import logger from "@/lib/logger";

import { BaseGraphObject } from "./BaseGraphObject";
import { GraphObject } from "./GraphObject";
import { GraphStore } from "./GraphStore";

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
      hasCustomTypeRelation: computed,
      customTypeRelation: computed,
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

  get hasCustomTypeRelation(): boolean {
    const typeRelations = this.relations.filter(
      (relation) => relation.relationTypeId == defaultRelationTypes.__type__.id,
    );
    return typeRelations.length !== 0;
  }

  get customTypeRelation(): GraphRelation | null {
    const typeRelations = this.relations.filter(
      (relation) => relation.relationTypeId === defaultRelationTypes.__type__.id,
    );
    if (typeRelations.length === 0) {
      return null;
    } else if (typeRelations.length === 1) {
      return typeRelations[0];
    } else {
      logger.error("There can only be one __type__ relation", {
        relationId: this.id,
        count: typeRelations.length,
      });
      return typeRelations[0];
    }
  }

  /*
   * Graph relation types can be either a default relationType or a custom relationType. The custom relationTypes are types that are
   * assigned via a relation of type '__type__' pointing from that relation to another node
   */
  get relationType(): GraphRelationType {
    // Look for a relation type with type id '__type__'

    const typeRelations = this.relations.filter(
      (relation) => relation.relationTypeId == defaultRelationTypes.__type__.id,
    );
    if (typeRelations.length > 0) {
      if (typeRelations.length > 1) {
        console.warn(`Found multiple type relations for relation ${this.id}`);
      }
      const typeRelation = typeRelations[0];

      const fwTypeNode = typeRelation.to;

      const reverseRelations = typeRelation.to.relations.filter(
        (relation) => relation.relationTypeId == defaultRelationTypes.__reverse__.id,
      );
      let reverseLabel = fwTypeNode.text;

      if (reverseRelations.length > 0) {
        const reverseRelation = reverseRelations[0];
        reverseLabel = reverseRelation.to.text;
      }

      if (fwTypeNode) {
        const foundType = this.store.relationTypesById[fwTypeNode.id];
        if (foundType) {
          return foundType;
        }
        return {
          id: fwTypeNode.id,
          label: fwTypeNode.text,
          reverseLabel: reverseLabel,
          authorId: typeRelation.authorId,
          version: typeRelation.version,
          isPublic: typeRelation.isPublic || typeRelation.to.isPublic || typeRelation.from.isPublic,
        };
      }
    }
    if (!this.store.relationTypesById[this.relationTypeId]) {
      throw new Error("AHAAHAHAH!!");
    }
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
