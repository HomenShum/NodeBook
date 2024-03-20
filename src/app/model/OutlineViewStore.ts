import { makeAutoObservable } from "mobx";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphStore } from "./GraphStore";
import { Bullet } from "./OutlineBullet";
import { ViewStore } from "./ViewStore";

export class OutlineViewStore {
  private graphStore: GraphStore;
  private viewStore: ViewStore;
  private viewsByNodeId: Map<string, Bullet>;
  public root: Bullet | null = null;

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    this.viewsByNodeId = new Map();
    makeAutoObservable(this);
  }

  setRoot(node: Bullet) {
    this.root = node;
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

  createBullet({
    graphNodeProps = {},
    parent,
    target,
    side = "above",
  }: {
    graphNodeProps: GraphNodeProps;
    parent: Bullet;
    target?: Bullet;
    side?: "above" | "below";
  }) {
    const graphNode = this.graphStore.createNode(graphNodeProps);
    const relation = this.graphStore.createRelation(
      {
        from: parent.graphNode,
        to: graphNode,
        type: this.graphStore.relationTypesById.child,
      },
      {
        fromTarget: target?.graphRelation!,
        fromSide: side,
      },
    );
    const bullet = new Bullet(this, graphNode, { relation, parent });
    parent.childrenByRelationId.set(relation.id, bullet);
    return bullet;
  }

  moveBulletToNewParent(
    { parent, target, side }: { parent: Bullet; target?: Bullet; side?: "above" | "below" },
    ...bullets: Bullet[]
  ) {
    this.graphStore.updateRelationFrom(
      { newFrom: parent.graphNode, target: target?.graphRelation!, side },
      ...bullets.map((b) => b.graphRelation!),
    );
    bullets.forEach((b) => {
      parent.childrenByRelationId.set(b.graphRelation!.id, b);
      b.parent = parent;
    });
  }

  splitBullet(bullet: Bullet, start: number, end?: number): Bullet {
    if (!bullet.parent) {
      throw new Error("Can't split bullet with no parent");
      // TODO this shouldn't be possible?
    }
    const text = bullet.graphNode.text;
    end = end ?? start;
    // Update the existing node with the text before the cursor
    const textBefore = text.slice(0, start);
    bullet.graphNode.setText(textBefore);
    // Create a new node below, with the text after the cursor
    const textAfter = text.slice(end);
    return this.createBullet({
      graphNodeProps: { text: textAfter },
      parent: bullet.parent!,
      target: bullet,
      side: "below",
    });
  }

  deleteNode(bullet: Bullet) {
    const parent = bullet.parent;
    if (!parent) throw new Error("Node has no parent");
    parent.childrenByRelationId.delete(bullet.graphRelation?.id ?? "");
    this.graphStore.deleteNode(bullet.graphNode.id);
  }

  setGraphNodeOnBullet(bullet: Bullet, graphNode: GraphNode) {
    if (bullet.isRelationToThis()) {
      this.graphStore.updateRelationTo({ newTo: graphNode }, bullet.graphRelation!);
    } else {
      this.graphStore.updateRelationFrom({ newFrom: graphNode }, bullet.graphRelation!);
    }
    bullet.graphNode = graphNode;
    bullet.childrenByRelationId = new Map(); // TODO sketch
  }
}
