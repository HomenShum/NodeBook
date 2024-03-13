import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphStore } from "./GraphStore";
import { GraphRelation } from "./GraphRelation";
import { RemoteGraphStore } from "./RemoteGraphStore";

export type GraphNodeProps = {
  id?: string;
  text?: string;
};

export class GraphNode {
  public id: string;
  public text: string = "";
  public relations: GraphRelation[] = [];

  constructor(
    private store: GraphStore,
    private remote?: RemoteGraphStore,
    { id, text = "" }: GraphNodeProps = {}
  ) {
    this.id = id || uuid();
    this.text = text;
    makeAutoObservable(this);
  }

  setText(text: string) {
    this.text = text;
    if (this.remote) {
      this.remote.upsertNode(this.id, text);
    }
  }

  createChild() {
    const child = this.store.createNode();
    const relation = this.store.insertRelation(
      new GraphRelation(this.store, {
        from: this,
        to: child,
        type: this.store.relationTypes.child,
      })
    );
    return { child, relation };
  }

  delete() {
    this.store.deleteNode(this.id);
  }

  get children(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypes.child.id && r.from === this)
      .map((r) => r.to);
  }

  get parents(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypes.child.id && r.to === this)
      .map((r) => r.from);
  }

  get relatedNodes(): GraphNode[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }
}
