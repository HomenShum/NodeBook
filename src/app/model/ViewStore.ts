import { GraphStore } from "./GraphStore";
import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { Bullet } from "./OutlineBullet";
import { GraphNodeView } from "./GraphNodeView";
import { Note } from "./ThoughtstreamNote";

export enum ViewType {
  OUTLINE = "outline",
  THOUGHTSTREAM = "thoughtstream",
}

export class ViewStore {
  public curView: ViewType;

  private graphStore: GraphStore;

  public currentViewRoot: GraphNodeView | null = null;
  public focusedNode: GraphNodeView | null = null;
  public hoveredNode: GraphNodeView | null = null;

  public showNodeDetails = true;

  constructor(graphStore: GraphStore) {
    this.curView = ViewType.OUTLINE;
    this.graphStore = graphStore;
    makeAutoObservable(this);
  }

  setView(view: ViewType) {
    this.curView = view;
    const rootNode = this.currentViewRoot!.graphNode;
    switch (this.curView) {
      case "outline":
        this.currentViewRoot = new Bullet(this, rootNode);
        break;
      case "thoughtstream":
        this.currentViewRoot = new Note(this, rootNode);
        break;
    }
  }

  setRoot(node: GraphNode) {
    switch (this.curView) {
      case "outline":
        this.currentViewRoot = new Bullet(this, node);
        break;
      case "thoughtstream":
        this.currentViewRoot = new Note(this, node);
        break;
    }
  }

  setFocusedNode(node: GraphNodeView | null) {
    this.focusedNode = node;
  }

  setHoveredNode(node: GraphNodeView | null) {
    this.hoveredNode = node;
  }

  insertGraphNodeToOutline(
    node: GraphNode,
    relation: GraphRelation,
    parent: Bullet
  ) {
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
    this.graphStore.updateRelationFrom(
      bullet.graphRelation!,
      newParent.graphNode
    );
  }

  deleteNode(bullet: Bullet) {
    const parent = bullet.parent;
    if (!parent) throw new Error("Node has no parent");
    parent.childrenByRelationId.delete(bullet.graphRelation?.id ?? "");
    this.graphStore.deleteNode(bullet.graphNode.id);
  }
}
