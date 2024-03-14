import { GraphNode, GraphNodeProps } from "./GraphNode";
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

  insertGraphNodeToOutline({
    graphNode,
    relation,
    parent,
    position,
  }: {
    graphNode: GraphNode;
    relation: GraphRelation;
    parent: Bullet;
    position?: string;
  }) {
    if (relation.from.id !== parent.graphNode.id) {
      throw new Error("Relation's from node is not the parent node");
    }
    if (relation.to.id !== graphNode.id) {
      throw new Error("Relation's 'to' property is not the node being created");
    }
    position = position || parent.lastChild.position;
    const bullet = new Bullet(this, graphNode, relation, parent, { position });
    parent.childrenByRelationId.set(relation.id, bullet);
    this.viewsByNodeId.set(graphNode.id, bullet);
    return bullet;
  }

  createNode({
    parent,
    graphNodeProps = {},
    position,
  }: {
    parent: Bullet;
    graphNodeProps: GraphNodeProps;
    position?: string;
  }) {
    const graphNode = this.graphStore.createNode(graphNodeProps);
    const relation = this.graphStore.createRelation({
      from: parent.graphNode,
      to: graphNode,
      type: this.graphStore.relationTypesById.child,
    });
    return this.insertGraphNodeToOutline({ graphNode, relation, parent, position });
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
