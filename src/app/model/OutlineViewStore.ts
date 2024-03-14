import { GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { Bullet } from "./OutlineBullet";
import { ViewStore } from "./ViewStore";

export class OutlineViewStore {
  private graphStore: GraphStore;
  private viewStore: ViewStore;

  private viewsByNodeId: Map<string, Bullet>;

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    this.viewsByNodeId = new Map();
  }

  setFocusedNode(node: Bullet | null) {
    this.viewStore.setFocusedNode(node);
  }

  get focusedNode() {
    return this.viewStore.focusedNode;
  }

  viewForNode(node: GraphNode) {
    const existing = this.viewsByNodeId.get(node.id);
    if (existing) return existing;

    const bullet = new Bullet(this, node);
    this.viewsByNodeId.set(node.id, bullet);
    return bullet;
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
    this.viewsByNodeId.set(node.id, bullet);
    return bullet;
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
}
