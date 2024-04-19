import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode } from "./GraphNode";
import { GraphStore, defaultRelationTypes } from "./GraphStore";
import { Serializable } from "./serialization";

export type GraphRelationType = {
  id: string;
  label: string;
  reverseLabel: string;
};

export type GraphRelationProps = {
  id?: string;
  from: GraphNode;
  to: GraphNode;
  type?: GraphRelationType;
};

export class GraphRelation implements Serializable {
  public id: string;
  public from: GraphNode;
  public to: GraphNode;
  public type: GraphRelationType;
  public createdAt: Date = new Date();
  private store: GraphStore;

  constructor(store: GraphStore, { id = uuid(), from, to, type = defaultRelationTypes.child }: GraphRelationProps) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.type = type;
    this.store = store;
    makeAutoObservable(this);
  }

  setType(type: GraphRelationType) {
    this.type = type;
  }

  setFrom(node: GraphNode) {
    this.from = node;
  }

  setTo(node: GraphNode) {
    this.to = node;
  }

  delete() {
    this.store.deleteRelation(this);
  }

  updateType(newType: GraphRelationType) {
    this.store.updateRelationsType(this, newType);
  }

  serialize() {
    return {
      id: this.id,
      fromId: this.from.id,
      toId: this.to.id,
      type: this.type,
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
      type: data.type,
    });
  }
}
