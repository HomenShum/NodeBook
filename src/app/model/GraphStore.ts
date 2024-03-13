import { makeAutoObservable } from "mobx";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { RemoteGraphStore } from "./RemoteGraphStore";

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  isLoading = false;
  remote?: RemoteGraphStore;
  public relationTypes = {
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

  createNode(
    props: GraphNodeProps = {},
    { fromServer = false }: { fromServer?: boolean } = {}
  ): GraphNode {
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

  insertRelation(
    relation: GraphRelation,
    { fromServer = false }: { fromServer?: boolean } = {}
  ): GraphRelation {
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
    const type = this.relationTypes[persistedRelation.typeId as keyof typeof this.relationTypes]; // TODO
    if (!from || !to || !type) {
      throw new Error("Invalid persisted relation");
    }
    const relation = new GraphRelation(this, { from, to, type });
    this.insertRelation(relation, { fromServer: true });
  }
}
