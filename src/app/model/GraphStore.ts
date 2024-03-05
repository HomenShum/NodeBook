import { makeAutoObservable } from "mobx";
import { uuid } from "../util";

export type GraphNodeProps = {
  id?: string;
  text?: string;
};

export type GraphRelationProps = {
  from: GraphNode;
  to: GraphNode;
  type: GraphRelationType;
};

export class GraphNode {
  public id: string;
  public text: string = "";
  public relations: GraphRelation[] = [];

  constructor(private store: GraphStore, { id, text = "" }: GraphNodeProps = {}) {
    this.id = id || uuid();
    this.text = text;
    makeAutoObservable(this);
  }

  setText(text: string) {
    this.text = text;
  }

  createChild() {
    const child = this.store.createNode();
    const relation = this.store.insertRelation(
      new GraphRelation(this.store, { from: this, to: child, type: this.store.relationTypes.child })
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

export class GraphRelation {
  public id: string;
  public from: GraphNode;
  public to: GraphNode;
  public type: GraphRelationType;
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

  updateFrom(newFrom: GraphNode) {
    this.store.updateRelationFrom(this, newFrom);
  }
}

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  public relationTypes = {
    child: { id: "child", label: "child", reverseLabel: "parent" },
    link: { id: "link", label: "link", reverseLabel: "backlink" },
  };
  constructor() {
    makeAutoObservable(this);
  }

  get nodes(): GraphNode[] {
    return Array.from(this.nodesById.values());
  }

  get relations(): GraphRelation[] {
    return Array.from(this.relationsById.values());
  }

  createNode(props: GraphNodeProps = {}): GraphNode {
    const node = new GraphNode(this, props);
    this.nodesById.set(node.id, node);
    return node;
  }

  insertNode(node: GraphNode): GraphNode {
    if (this.nodesById.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodesById.set(node.id, node);
    return node;
  }

  deleteNode(id: string) {
    const node = this.nodesById.get(id);
    if (!node) return;
    node.relations.forEach((r) => r.delete());
    this.nodesById.delete(node.id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  createRelation(props: GraphRelationProps): GraphRelation {
    return this.insertRelation(new GraphRelation(this, props));
  }

  insertRelation(relation: GraphRelation): GraphRelation {
    if (this.relationsById.has(relation.id)) {
      throw new Error(`Relation with id ${relation.id} already exists`);
    }
    this.assertNodeExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);
    relation.from.relations.push(relation);
    relation.to.relations.push(relation);
    return relation;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;
    // why do we need to compare the ids instead of the objects?
    fromNode.relations = fromNode.relations.filter((r) => r.id !== relation.id);
    toNode.relations = toNode.relations.filter((r) => r.id !== relation.id);
    this.relationsById.delete(relation.id);
  }

  updateRelationFrom(relation: GraphRelation, newFrom: GraphNode): GraphRelation | undefined {
    this.assertNodeExists(newFrom, relation.to);
    const oldFrom = relation.from;
    oldFrom.relations = oldFrom.relations.filter((r) => r.id !== relation.id);
    newFrom.relations.push(relation);
    relation.from = newFrom;
    return relation;
  }

  updateRelationType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.type = newType;
    return relation;
  }

  private assertNodeExists(...nodes: (GraphNode | string)[]): void {
    nodes.forEach((node) => {
      const id = typeof node === "string" ? node : node.id;
      if (!this.nodesById.has(id)) {
        throw new Error(`Node with id ${id} does not exist`);
      }
    });
  }
}

export type GraphRelationType = {
  id: string;
  label: string;
  reverseLabel?: string;
};
