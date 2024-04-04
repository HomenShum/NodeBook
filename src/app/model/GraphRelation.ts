import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode } from "./GraphNode";
import { GraphStore } from "./GraphStore";

export type GraphRelationType = {
  id: string;
  label: string;
  reverseLabel: string;
};

export type GraphRelationProps = {
  from: GraphNode;
  to: GraphNode;
  type: GraphRelationType;
};

export class GraphRelation {
  public id: string;
  public from: GraphNode;
  public to: GraphNode;
  public type: GraphRelationType;
  public createdAt: Date = new Date();
  private store: GraphStore;

  constructor(store: GraphStore, { from, to, type }: GraphRelationProps) {
    this.id = uuid();
    this.from = from;
    this.to = to;
    this.type = type;
    this.store = store;
    makeAutoObservable(this);
  }

  delete() {
    this.store.deleteRelation(this);
  }

  updateType(newType: GraphRelationType) {
    this.store.updateRelationsType(this, newType);
  }
}
