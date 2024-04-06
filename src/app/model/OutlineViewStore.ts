import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable } from "mobx";
import { Chip, GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { Bullet } from "./OutlineBullet";
import { ViewStore } from "./ViewStore";

export class OutlineViewStore {
  public graphStore: GraphStore;
  public viewStore: ViewStore;
  public root: Bullet | null = null;
  public thoughtstream: Bullet;
  public relatedNodesViewType: "all" | "pinned" = "all";
  public bulletsById: Map<string, Bullet> = new Map();

  constructor(graphStore: GraphStore, viewStore: ViewStore) {
    this.graphStore = graphStore;
    this.viewStore = viewStore;
    makeAutoObservable(this);
    this.root = this.createBullet({
      node: this.graphStore.outlineRoot,
      relation: this.graphStore.outlineRootRelationToUserRoot,
    });
    this.thoughtstream = this.createBullet({
      node: this.graphStore.thoughtstreamRoot,
      relation: this.graphStore.thoughtstreamRootRelationToUserRoot,
    });
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

  createBullet({ parent, node, relation }: { parent?: Bullet; node: GraphNode; relation: GraphRelation }) {
    const bullet = new Bullet(this, node, relation, { parent });
    this.bulletsById.set(bullet.id, bullet);
    parent?.childrenByRelationId.set(relation.id, bullet);
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

  splitBullet(bullet: Bullet, selection: BaseSelection): Bullet | null {
    if (!bullet.parent) {
      throw new Error("Can't split bullet with no parent");
      // TODO this shouldn't be possible?
    }

    // Get text before and after the cursor
    const points = selection?.getStartEndPoints();
    if (!points) return null;
    const start = points[0].offset;
    const end = points[1].offset;

    const selectionNodes = selection.getNodes();
    const firstNode = selectionNodes[0];
    const lastNode = selectionNodes[selectionNodes.length - 1];

    const paragraphNode = firstNode.getParent();
    const paragraphChildren: LexicalNode[] = paragraphNode.getChildren();

    const firstNodeIndexInParagraph = paragraphChildren.findIndex((node) => node === firstNode);
    const lastNodeIndexInParagraph = paragraphChildren.findIndex((node) => node === lastNode);

    const startIndex = selection.isBackward() ? lastNodeIndexInParagraph : firstNodeIndexInParagraph;
    const endIndex = selection.isBackward() ? firstNodeIndexInParagraph : lastNodeIndexInParagraph;

    let chipsBefore: Chip[] = [];
    let chipsAfter: Chip[] = [];
    bullet.graphNode.content.forEach((chip, idx) => {
      if (idx < startIndex) {
        // All chips before the start index are part of chipsBefore
        chipsBefore.push({ type: chip.type, value: chip.value });
      } else if (idx > endIndex) {
        // All chips after the end index are part of chipsAfter
        chipsAfter.push({ type: chip.type, value: chip.value });
      } else {
        // For chips within the selection range, split based on start and end offsets
        if (idx === startIndex) {
          // For the first node in the selection, add the text after the start offset to chipsAfter
          if (start < chip.value.length) {
            if (chip.type === "text") {
              chipsAfter.push({ type: "text", value: chip.value.substring(start) });
            } else {
              const mentionText = paragraphChildren[idx]?.getTextContent() || "";
              chipsAfter.push({ type: "text", value: mentionText.substring(start) });
            }
          }
        } else if (idx === endIndex) {
          // For the last node in the selection, add the text before the end offset to chipsBefore
          if (end > 0) {
            if (chip.type === "text") {
              chipsBefore.push({ type: "text", value: chip.value.substring(0, end) });
            } else {
              const mentionText = paragraphChildren[idx]?.getTextContent() || "";
              chipsBefore.push({ type: "text", value: mentionText.substring(0, end) });
            }
          }
        }
        // Nodes between the start and end nodes are deleted by ignoring them
      }
    });

    bullet.graphNode.setContent(chipsBefore);
    const newBullet = bullet.parent.createChild({ content: chipsAfter });
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
  }
}
