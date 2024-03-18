import { PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { makeAutoObservable } from "mobx";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { RemoteGraphStore } from "./RemoteGraphStore";

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  isLoading = false;
  remote?: RemoteGraphStore;
  public relationTypesById: Record<string, GraphRelationType> = {
    child: { id: "child", label: "child", reverseLabel: "parent" },
    link: { id: "link", label: "link", reverseLabel: "backlink" },
  };
  constructor(remote?: RemoteGraphStore) {
    this.remote = remote;
    makeAutoObservable(this);
  }

  get nodes(): GraphNode[] {
    return Array.from(this.nodesById.values());
  }

  get relations(): GraphRelation[] {
    return Array.from(this.relationsById.values());
  }

  get relationTypes(): GraphRelationType[] {
    return Object.values(this.relationTypesById);
  }

  createNode(props: GraphNodeProps = {}, { fromServer = false }: { fromServer?: boolean } = {}): GraphNode {
    const node = new GraphNode(this, this.remote, props);
    this.nodesById.set(node.id, node);
    if (!fromServer && this.remote) {
      this.remote.upsertNode(node.id, node.text);
    }
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

  insertRelation(relation: GraphRelation, { fromServer = false }: { fromServer?: boolean } = {}): GraphRelation {
    if (this.relationsById.has(relation.id)) {
      throw new Error(`Relation with id ${relation.id} already exists`);
    }
    this.assertNodeExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);
    relation.from.relations.push(relation);
    relation.to.relations.push(relation);
    if (!fromServer && this.remote) {
      this.remote.upsertRelation(relation.id, relation.from.id, relation.to.id, relation.type.id);
    }
    return relation;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;
    // why do we need to compare the ids instead of the objects?
    fromNode.relations = fromNode.relations.filter((r) => r.id !== relation.id);
    toNode.relations = toNode.relations.filter((r) => r.id !== relation.id);
    this.relationsById.delete(relation.id);
    this.deleteNodeIfEmptyAndUnrelated(fromNode, toNode);
  }

  updateRelationFrom(relation: GraphRelation, newFrom: GraphNode): GraphRelation | undefined {
    this.assertNodeExists(newFrom, relation.to);
    const oldFrom = relation.from;
    oldFrom.relations = oldFrom.relations.filter((r) => r.id !== relation.id);
    newFrom.relations.push(relation);
    relation.from = newFrom;
    this.deleteNodeIfEmptyAndUnrelated(oldFrom);
    return relation;
  }

  updateRelationTo(relation: GraphRelation, newTo: GraphNode): GraphRelation | undefined {
    this.assertNodeExists(relation.from, newTo);
    const oldTo = relation.to;
    oldTo.relations = oldTo.relations.filter((r) => r.id !== relation.id);
    newTo.relations.push(relation);
    relation.to = newTo;
    this.deleteNodeIfEmptyAndUnrelated(oldTo);
    return relation;
  }

  reverseRelation(relation: GraphRelation): GraphRelation {
    const { from, to } = relation;
    relation.from = to;
    relation.to = from;
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.type = newType;
    return relation;
  }

  createRelationType(props: GraphRelationType): GraphRelationType {
    if (this.relationTypesById[props.id]) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    this.relationTypesById[props.id] = { ...props };
    return this.relationTypesById[props.id];
  }

  updateRelationType(id: string, props: Partial<Omit<GraphRelationType, "id">>): GraphRelationType {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    Object.assign(this.relationTypesById[id], { ...props, id });
    return this.relationTypesById[id];
  }

  deleteRelationType(id: string) {
    // find all relations with this type and set them to a default type
    this.relations.forEach((r) => {
      r.updateType(this.relationTypesById.child);
    });
    delete this.relationTypesById[id];
  }

  private assertNodeExists(...nodes: (GraphNode | string)[]): void {
    nodes.forEach((node) => {
      const id = typeof node === "string" ? node : node.id;
      if (!this.nodesById.has(id)) {
        throw new Error(`Node with id ${id} does not exist`);
      }
    });
  }

  private deleteNodeIfEmptyAndUnrelated(...nodes: GraphNode[]) {
    nodes.forEach((node) => {
      if (node.text === "" && node.relations.length === 0) {
        this.deleteNode(node.id);
      }
    });
  }

  async loadFromServer() {
    this.isLoading = true;
    if (!this.remote) {
      console.warn("No remote store");
    } else {
      try {
        const { nodes, relations } = await this.remote.load();
        nodes.forEach((n: PersistedGraphNode) => this.addNodeFromServer(n));
        relations.forEach((r: PersistedGraphRelation) => this.addRelationFromServer(r));
      } catch (e) {
        console.error(e);
      }
    }
    this.isLoading = false;
  }

  addNodeFromServer(persistedNode: PersistedGraphNode) {
    this.createNode({ id: persistedNode.id, text: persistedNode.text }, { fromServer: true });
  }

  addRelationFromServer(persistedRelation: PersistedGraphRelation) {
    const from = this.getNode(persistedRelation.fromId);
    const to = this.getNode(persistedRelation.toId);
    const type = this.relationTypesById[persistedRelation.typeId as keyof typeof this.relationTypesById]; // TODO
    if (!from || !to || !type) {
      throw new Error("Invalid persisted relation");
    }
    const relation = new GraphRelation(this, { from, to, type });
    this.insertRelation(relation, { fromServer: true });
  }
}
