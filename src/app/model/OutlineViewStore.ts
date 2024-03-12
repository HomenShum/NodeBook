import { GraphStore } from "./GraphStore";
import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { Bullet } from "./OutlineBullet";

/**
 * The store for the tree view of the graph.
 * Methods which add or move a node in the tree view also update the graph to reflect the change.
 */
export class OutlineViewStore {
  public root: Bullet;
  public currentViewRoot: Bullet;
  public focusedNode: Bullet | null = null;
  public hoveredNode: Bullet | null = null;
  public showBulletDetails = false;
  private graphStore: GraphStore;
  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    const root = graphStore.getNode("root");
    if (!root) throw new Error("Root node not found");
    this.root = new Bullet(this, root);
    this.currentViewRoot = this.root;
    makeAutoObservable(this);
  }

  toggleBulletDetails() {
    this.showBulletDetails = !this.showBulletDetails;
  }

  insertGraphNodeToOutline(node: GraphNode, relation: GraphRelation, parent: Bullet) {
    if (relation.from.id !== parent.graphNode.id) {
      throw new Error("Relation's from node is not the parent node");
    }
    if (relation.to.id !== node.id) {
      throw new Error("Relation's 'to' property is not the node being created");
    }
    const bullet = new Bullet(this, node, relation, parent);
    parent.childrenByRelationId.set(relation.id, bullet);
    return bullet;
  }

  createNode(parent: Bullet) {
    const graphNode = this.graphStore.createNode();
    const relation = this.graphStore.createRelation({
      from: parent.graphNode,
      to: graphNode,
      type: this.graphStore.relationTypes.child,
    });
    return this.insertGraphNodeToOutline(graphNode, relation, parent);
  }

  updateNodeToParent(bullet: Bullet, newParent: Bullet, after?: Bullet) {
    const currentParent = bullet.parent;
    if (!currentParent) throw new Error("Node has no parent");
    // Remove the tree node from the old parent
    const oldParent = bullet.parent;
    oldParent?.childrenByRelationId.delete(bullet.graphRelation?.id ?? "");
    // Set the new parent
    newParent.childrenByRelationId.set(bullet.graphRelation?.id ?? "", bullet);
    bullet.parent = newParent;
    // Update the graph
    // TODO remove !
    this.graphStore.updateRelationFrom(bullet.graphRelation!, newParent.graphNode);
  }

  deleteNode(bullet: Bullet) {
    const parent = bullet.parent;
    if (!parent) throw new Error("Node has no parent");
    parent.childrenByRelationId.delete(bullet.graphRelation?.id ?? "");
    this.graphStore.deleteNode(bullet.graphNode.id);
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
