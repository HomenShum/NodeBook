import { GraphStore } from "./GraphStore";
import { GraphRelation } from "./GraphStore";
import { GraphNode } from "./GraphStore";
import { makeAutoObservable } from "mobx";
import { uuid } from "../util";

export class Bullet {
  private treeStore: OutlineViewStore;
  // we need this in addition to the relation because the root node has no relation
  // (maybe we should just special case the root node?)
  public graphNode: GraphNode;
  // TODO I should make this not nullable somehow
  public graphRelation: GraphRelation | null;
  public parent: Bullet | null;
  public isExpanded: boolean;
  public childrenByRelationId: Map<string, Bullet>;
  public id: string;
  constructor(
    store: OutlineViewStore,
    node: GraphNode,
    relation: GraphRelation | null = null,
    parent: Bullet | null = null,
    {
      isExpanded,
      childrenByRelationId,
      id,
    }: {
      isExpanded?: boolean;
      childrenByRelationId?: Map<string, Bullet>;
      id?: string;
    } = {}
  ) {
    this.treeStore = store;
    this.graphNode = node;
    this.graphRelation = relation;
    this.parent = parent;
    this.isExpanded = isExpanded ?? false;
    this.childrenByRelationId = childrenByRelationId ?? new Map();
    this.id = id ?? uuid();
    makeAutoObservable(this);
  }

  insertGraphNode(node: GraphNode, relation: GraphRelation) {
    return this.treeStore.insertGraphNodeToTree(node, relation, this);
  }

  createChild() {
    return this.treeStore.createNode(this);
  }

  delete() {
    this.treeStore.deleteNode(this);
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  get isFocused() {
    return this.treeStore.focusedNode?.id === this.id;
  }

  get parents() {
    const parents: Bullet[] = [];
    let current: Bullet = this;
    while (current.parent) {
      parents.unshift(current.parent);
      current = current.parent;
    }
    return parents;
  }

  get children() {
    const newChildren: Bullet[] = [];
    this.graphNode.relations.forEach((relation) => {
      const existing = this.childrenByRelationId.get(relation.id);
      if (existing) {
        newChildren.push(existing);
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newTreeNode = new Bullet(this.treeStore, relatedNode, relation, this);
        newChildren.push(newTreeNode);
        this.childrenByRelationId.set(relation.id, newTreeNode);
      }
    });
    return newChildren;
  }
}

/**
 * The store for the tree view of the graph.
 * Methods which add or move a node in the tree view also update the graph to reflect the change.
 */
export class OutlineViewStore {
  public root: Bullet;
  public currentViewRoot: Bullet;
  public focusedNode: Bullet | null = null;
  public hoveredNode: Bullet | null = null;
  private graphStore: GraphStore;
  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    const root = graphStore.getNode("root");
    if (!root) throw new Error("Root node not found");
    this.root = new Bullet(this, root);
    this.currentViewRoot = this.root;
    makeAutoObservable(this);
  }

  insertGraphNodeToTree(node: GraphNode, relation: GraphRelation, parent: Bullet) {
    if (relation.from.id !== parent.graphNode.id) {
      throw new Error("Relation's from node is not the parent node");
    }
    if (relation.to.id !== node.id) {
      throw new Error("Relation's 'to' property is not the node being created");
    }
    const treeNode = new Bullet(this, node, relation, parent);
    parent.childrenByRelationId.set(relation.id, treeNode);
    return treeNode;
  }

  createNode(parent: Bullet) {
    const graphNode = this.graphStore.createNode();
    const relation = this.graphStore.createRelation({
      from: parent.graphNode,
      to: graphNode,
      type: this.graphStore.relationTypes.child,
    });
    return this.insertGraphNodeToTree(graphNode, relation, parent);
  }

  updateNodeToParent(treeNode: Bullet, newParent: Bullet, after?: Bullet) {
    const currentParent = treeNode.parent;
    if (!currentParent) throw new Error("Node has no parent");
    // Remove the tree node from the old parent
    const oldParent = treeNode.parent;
    oldParent?.childrenByRelationId.delete(treeNode.graphRelation?.id ?? "");
    // Set the new parent
    newParent.childrenByRelationId.set(treeNode.graphRelation?.id ?? "", treeNode);
    treeNode.parent = newParent;
    // Update the graph
    // TODO remove !
    this.graphStore.updateRelationFrom(treeNode.graphRelation!, newParent.graphNode);
  }

  deleteNode(treeNode: Bullet) {
    const parent = treeNode.parent;
    if (!parent) throw new Error("Node has no parent");
    parent.childrenByRelationId.delete(treeNode.graphRelation?.id ?? "");
    this.graphStore.deleteNode(treeNode.graphNode.id);
  }

  setCurrentViewRoot(node: Bullet) {
    this.currentViewRoot = node;
  }

  setFocusedNode(node: Bullet | null) {
    this.focusedNode = node;
  }

  setHoveredNode(node: Bullet | null) {
    this.hoveredNode = node;
  }
}
