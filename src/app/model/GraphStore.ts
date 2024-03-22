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
  public relationTypesById: Record<string, GraphRelationType> = {};
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
      this.remote.upsertNode(node.id, node.text, node.thoughtstreamPosition ?? null);
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
    if (this.remote) {
      this.remote.deleteNode(id);
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  createRelation(
    props: GraphRelationProps,
    insertRelationProps: {
      fromTarget?: GraphRelation;
      fromSide?: "above" | "below";
      toTarget?: GraphRelation;
      toSide?: "above" | "below";
      fromServer?: boolean; // TODO: need better naming which doesn't conflate the "from" usage here
    } = {},
  ): GraphRelation {
    return this.insertRelation(new GraphRelation(this, props), insertRelationProps);
  }

  insertRelation(
    relation: GraphRelation,
    {
      fromTarget,
      fromSide = "above",
      toTarget,
      toSide = "above",
      fromServer = false,
    }: {
      fromTarget?: GraphRelation;
      fromSide?: "above" | "below";
      toTarget?: GraphRelation;
      toSide?: "above" | "below";
      fromServer?: boolean; // TODO: need better naming which doesn't conflate the "from" usage here
    } = {},
  ): GraphRelation {
    if (this.relationsById.has(relation.id)) {
      throw new Error(`Relation with id ${relation.id} already exists`);
    }
    this.assertNodeExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);

    relation.from.insertRelation({ target: fromTarget, side: fromSide }, relation);
    relation.to.insertRelation({ target: toTarget, side: toSide }, relation);

    if (!fromServer && this.remote) {
      this.remote.upsertRelation(relation.id, relation.from.id, relation.to.id, relation.type.id);
    }
    return relation;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;
    fromNode.removeRelation(relation);
    toNode.removeRelation(relation);
    this.relationsById.delete(relation.id);
    if (this.remote) {
      this.remote.deleteRelation(relation.id);
    }
    this.deleteNodeIfEmptyAndUnrelated(fromNode, toNode);
  }

  updateRelationFrom(
    {
      newFrom,
      target,
      side = "above",
    }: {
      newFrom: GraphNode;
      target?: GraphRelation;
      side?: "above" | "below";
    },
    ...relations: GraphRelation[]
  ): GraphRelation[] {
    this.assertNodeExists(newFrom, ...relations.map((r) => r.to));
    // remove the relations from their old from nodes
    const oldFroms = relations.map((r) => {
      const oldFrom = r.from;
      oldFrom.removeRelation(r);
      return oldFrom;
    });
    // update the relations from property
    relations.forEach((r) => {
      r.from = newFrom;
    });
    // add the relations to the new from node
    newFrom.insertRelation({ target, side }, ...relations);
    this.deleteNodeIfEmptyAndUnrelated(...oldFroms);
    relations.forEach((r) => {
      this.remote?.upsertRelation(r.id, newFrom.id, r.to.id, r.type.id);
    });
    return relations;
  }

  updateRelationTo(
    {
      newTo,
      target,
      side = "above",
    }: {
      newTo: GraphNode;
      target?: GraphRelation;
      side?: "above" | "below";
    },
    ...relations: GraphRelation[]
  ): GraphRelation[] {
    this.assertNodeExists(newTo, ...relations.map((r) => r.from));
    // remove the relations from their old to nodes
    const oldTos = relations.map((r) => {
      const oldTo = r.to;
      oldTo.removeRelation(r);
      return oldTo;
    });
    // update the relations to property
    relations.forEach((r) => {
      r.to = newTo;
    });
    // add the relations to the new to node
    newTo.insertRelation({ target, side }, ...relations);
    this.deleteNodeIfEmptyAndUnrelated(...oldTos);
    relations.forEach((r) => {
      this.remote?.upsertRelation(r.id, r.from.id, newTo.id, r.type.id);
    });
    return relations;
  }

  reverseRelation(relation: GraphRelation): GraphRelation {
    const { from, to } = relation;
    relation.from = to;
    relation.to = from;
    if (this.remote) {
      this.remote.upsertRelation(relation.id, relation.from.id, relation.to.id, relation.type.id);
    }
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.type = newType;
    if (this.remote) {
      this.remote.upsertRelation(relation.id, relation.from.id, relation.to.id, relation.type.id);
    }
    return relation;
  }

  createRelationType(props: GraphRelationType, fromServer = false): GraphRelationType {
    if (this.relationTypesById[props.id]) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    this.relationTypesById[props.id] = { ...props };
    if (this.remote && !fromServer) {
      this.remote.upsertRelationType(props.id, props.label, props.reverseLabel);
    }
    return this.relationTypesById[props.id];
  }

  updateRelationType(id: string, props: Partial<Omit<GraphRelationType, "id">>): GraphRelationType {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    Object.assign(this.relationTypesById[id], { ...props, id });
    if (this.remote) {
      this.remote.upsertRelationType(id, this.relationTypesById[id].label, this.relationTypesById[id].reverseLabel);
    }
    return this.relationTypesById[id];
  }

  deleteRelationType(id: string) {
    // find all relations with this type and set them to a default type
    this.relations.forEach((r) => {
      r.updateType(this.relationTypesById.child);
    });
    delete this.relationTypesById[id];
    if (this.remote) {
      this.remote.deleteRelationType(id);
    }
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
      this.relationTypesById = {
        child: { id: "child", label: "child", reverseLabel: "parent" },
        author: { id: "author", label: "author", reverseLabel: "authored" },
        reference: { id: "reference", label: "reference", reverseLabel: "referenced by" },
        relatesTo: { id: "relatesTo", label: "relates to", reverseLabel: "relates to" },
      };
    } else {
      try {
        const { nodes, relationTypes, relations } = await this.remote.load();
        nodes.forEach((n: PersistedGraphNode) => this.addNodeFromServer(n));
        relationTypes.forEach((rt: GraphRelationType) => this.createRelationType(rt, true));
        // TODO: clean up logic elsewhere so "child" type isn't hardcoded
        if (!this.relationTypesById.child) {
          this.createRelationType({ id: "child", label: "child", reverseLabel: "parent" });
        }
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
