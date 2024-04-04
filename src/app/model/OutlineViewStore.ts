import { makeAutoObservable } from "mobx";
import { GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { GraphStore, defaultRelationTypes } from "./GraphStore";
import { Bullet } from "./OutlineBullet";
import { ViewStore } from "./ViewStore";

export class OutlineViewStore {
  public graphStore: GraphStore;
  private viewStore: ViewStore;
  public root: Bullet | null = null;
  public relatedNodesViewType: "all" | "pinned" = "all";
  public bulletsById: Map<string, Bullet> = new Map();

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    makeAutoObservable(this);
  }

  setRelatedNodesViewType(type: "all" | "pinned") {
    this.relatedNodesViewType = type;
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

  registerNodeView(view: Bullet) {
    this.viewStore.registerNodeView(view);
  }

  removeNodeView(view: Bullet) {
    this.viewStore.removeNodeView(view);
  }

  createBullet({ parent, node, relation }: { parent: Bullet; node: GraphNode; relation: GraphRelation }) {
    const bullet = new Bullet(this, node, { parent, relation });
    this.bulletsById.set(bullet.id, bullet);
    parent.childrenByRelationId.set(relation.id, bullet);
    return bullet;
  }

  deleteBullet(bullet: Bullet) {
    this.graphStore.deleteRelation(bullet.graphRelation!);
    // TODO: ideally all this happens in reaction to the above
    this.bulletsById.delete(bullet.id);
    if (bullet.graphRelation) {
      bullet.parent?.childrenByRelationId.delete(bullet.graphRelation.id);
      bullet.parent?.pinnedByRelationId.delete(bullet.graphRelation.id);
    }
  }

  moveBulletToNewParent(
    { parent, target, side = "below" }: { parent: Bullet; target?: Bullet; side?: "above" | "below" },
    ...bullets: Bullet[]
  ) {
    this.graphStore.updateRelationFrom(
      { newFrom: parent.graphNode, target: target?.graphRelation!, side },
      ...bullets.map((b) => b.graphRelation!),
    );
    // We need to manually add the bullets to the respective maps because otherwise new bullets
    // will be created to reflect the new relations, and we'll lose things like the expanded states
    // underneath and focus state.
    // (TODO: This seems more complicated than it should be though. It's worth revisiting.)
    bullets.forEach((b) => {
      b.parent = parent;
      if (target?.isPinned) {
        parent.graphNode.pinRelation({ target: target.graphRelation!, side }, b.graphRelation!);
        parent.pinnedByRelationId.set(b.graphRelation!.id, b);
      } else {
        parent.childrenByRelationId.set(b.graphRelation!.id, b);
      }
    });
  }

  splitBullet(bullet: Bullet, start: number, end?: number): Bullet {
    if (!bullet.parent) {
      throw new Error("Can't split bullet with no parent");
      // TODO this shouldn't be possible?
    }
    if (!bullet.graphRelation) {
      throw new Error("Can't split bullet with no relation");
    }
    const text = bullet.graphNode.text;
    end = end ?? start;
    // Update the existing node with the text before the cursor
    const textBefore = text.slice(0, start);
    bullet.graphNode.setText(textBefore);
    // Create a new node below, with the text after the cursor
    const textAfter = text.slice(end);

    const graphNode = this.graphStore.createNode({ text: textAfter });
    const relation = this.graphStore.createRelation({
      from: bullet.parent.graphNode,
      to: graphNode,
      type: defaultRelationTypes.child,
    });
    const newBullet = this.createBullet({ parent: bullet.parent, node: graphNode, relation });
    newBullet.moveAfterSibling(bullet);
    return newBullet;
  }

  setGraphNodeOnBullet(bullet: Bullet, graphNode: GraphNode) {
    if (bullet.isRelationToThis()) {
      this.graphStore.updateRelationTo({ newTo: graphNode }, bullet.graphRelation!);
    } else {
      this.graphStore.updateRelationFrom({ newFrom: graphNode }, bullet.graphRelation!);
    }
    bullet.graphNode = graphNode;
    this.deleteBullet(bullet);
  }
}
