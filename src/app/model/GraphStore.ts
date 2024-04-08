import { PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { Chip, GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { Bullet } from "./OutlineBullet";
import { RemoteGraphStore } from "./RemoteGraphStore";

export const defaultRelationTypes = {
  child: { id: "child", label: "child", reverseLabel: "parent" },
  author: { id: "author", label: "author", reverseLabel: "authored" },
  reference: { id: "reference", label: "reference", reverseLabel: "referenced by" },
  relatesTo: { id: "relatesTo", label: "relates to", reverseLabel: "relates to" },
};

export const USER_ROOT_ID = "user-root-id";
export const OUTLINE_ROOT_ID = "outline-root-id";
export const THOUGHTSTREAM_ROOT_ID = "thoughtstream-root-id";

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationTypesById: Record<string, GraphRelationType> = {};
  bulletsById: Map<string, Bullet> = new Map();
  bulletsByRelationId: Map<string, Map<string, Bullet>> = new Map();

  // Default nodes and relations
  // TODO: do we need this? feels like there could be multiple
  outlineBulletRoot: Bullet;
  thoughtstreamBulletRoot: Bullet;
  userRoot: GraphNode;
  outlineRoot: GraphNode;
  thoughtstreamRoot: GraphNode;
  outlineRootRelationToUserRoot: GraphRelation;
  thoughtstreamRootRelationToUserRoot: GraphRelation;

  isLoading = false;

  /** Add outline descendants which are direct children of outline to outline */
  addThoughstreamDirectChildrenToOutline = true;
  /** Add thoughtstream descendants which are direct children of thoughtstream to thoughtstream */
  addAllOutlineDescendantsToThoughtstream = true;
  /** Add thoughtstream descendants which are not direct children of thoughtstream as direct children of thoughtstream */
  addThoughtstreamNestedChildrenToThoughtstream = false;
  /** When enabled, removing a node as a direct child of a thoughtstream will delete it */
  removingNodeAsDirectChildOfThoughtstreamDeletesIt = false;

  constructor() {
    Object.values(defaultRelationTypes).forEach((rt) => this.createRelationType(rt, true));
    makeAutoObservable(this);
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "Root" }] });
    this.userRoot = this.createNode({ id: USER_ROOT_ID, content: [{ type: "text", value: "User" }] });
    this.thoughtstreamRoot = this.createNode({
      id: THOUGHTSTREAM_ROOT_ID,
      content: [{ type: "text", value: "Thoughtstream" }],
    });
    this.outlineRootRelationToUserRoot = this.createRelation({
      from: this.userRoot,
      to: this.outlineRoot,
      type: this.relationTypesById.child,
    });
    this.thoughtstreamRootRelationToUserRoot = this.createRelation({
      from: this.userRoot,
      to: this.thoughtstreamRoot,
      type: this.relationTypesById.child,
    });
    this.outlineBulletRoot = this.createBullet({
      relation: this.outlineRootRelationToUserRoot,
    });
    this.thoughtstreamBulletRoot = this.createBullet({
      relation: this.thoughtstreamRootRelationToUserRoot,
    });
  }

  setAddThoughtstreamDirectChildrenToOutline(value: boolean) {
    this.addThoughstreamDirectChildrenToOutline = value;
  }

  setAddAllOutlineDescendantsToThoughtstream(value: boolean) {
    this.addAllOutlineDescendantsToThoughtstream = value;
  }

  setAddThoughtstreamNestedChildrenToThoughstream(value: boolean) {
    this.addThoughtstreamNestedChildrenToThoughtstream = value;
  }

  setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(value: boolean) {
    this.removingNodeAsDirectChildOfThoughtstreamDeletesIt = value;
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

  createNode(props: GraphNodeProps = {}): GraphNode {
    const node = new GraphNode(this, {
      id: props.id || uuid(),
      content: props.content,
    });
    this.nodesById.set(node.id, node);
    if (node.id === OUTLINE_ROOT_ID) {
      this.outlineRoot = node;
    } else if (node.id === THOUGHTSTREAM_ROOT_ID) {
      this.thoughtstreamRoot = node;
    } else if (node.id === USER_ROOT_ID) {
      this.userRoot = node;
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
    node.relations.forEach((r) => this.deleteRelation(r));
    this.nodesById.delete(node.id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  createRelation(props: GraphRelationProps): GraphRelation {
    return this.insertRelation(new GraphRelation(this, props));
  }

  insertRelation(relation: GraphRelation): GraphRelation {
    if (this.relationsById.has(relation.id)) {
      throw new Error(`Relation with id ${relation.id} already exists`);
    }
    this.assertNodeExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);

    relation.from.allRelationsList.add(relation);
    relation.to.allRelationsList.add(relation);

    return relation;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;

    // Remove the relation from the nodes
    fromNode.allRelationsList.delete(relation.id);
    fromNode.pinnedRelationsList.delete(relation.id);
    toNode.allRelationsList.delete(relation.id);
    toNode.pinnedRelationsList.delete(relation.id);

    // Delete all bullets in subtrees rooted at this relation
    const bullets = this.bulletsByRelationId.get(relation.id);
    bullets?.forEach((b) => this.deleteBulletAndDescendantsOnly(b.id));
    this.bulletsByRelationId.delete(relation.id);

    // Delete the relation itself
    this.relationsById.delete(relation.id);

    this.deleteNodeIfEmptyAndUnrelated(fromNode, toNode);
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  updateRelationFrom(relations: GraphRelation[], newFrom: GraphNode): GraphRelation[] {
    this.assertNodeExists(newFrom, ...relations.map((r) => r.to));
    // remove the relations from their old from nodes
    const oldFroms = relations.map((r) => {
      const oldFrom = r.from;
      oldFrom.allRelationsList.delete(r.id);
      oldFrom.pinnedRelationsList.delete(r.id);
      return oldFrom;
    });
    // update the relations from property
    relations.forEach((r) => {
      r.from = newFrom;
    });
    // add the relations to the new from node
    newFrom.allRelationsList.add(...relations);
    this.deleteNodeIfEmptyAndUnrelated(...oldFroms);
    return relations;
  }

  /**
   * Update the `to` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `to` nodes
   * to reflect the changes.
   */
  updateRelationTo(relations: GraphRelation[], newTo: GraphNode): GraphRelation[] {
    this.assertNodeExists(newTo, ...relations.map((r) => r.from));
    // remove the relations from their old to nodes
    const oldTos = relations.map((r) => {
      const oldTo = r.to;
      oldTo.allRelationsList.delete(r.id);
      oldTo.pinnedRelationsList.delete(r.id);
      return oldTo;
    });
    // update the relations to property
    relations.forEach((r) => {
      r.to = newTo;
    });
    // add the relations to the new to node
    newTo.allRelationsList.add(...relations);
    this.deleteNodeIfEmptyAndUnrelated(...oldTos);
    return relations;
  }

  reverseRelation(relation: GraphRelation): GraphRelation {
    const { from, to } = relation;
    relation.from = to;
    relation.to = from;
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.type = newType;
    return relation;
  }

  createRelationType(props: GraphRelationType, fromServer = false): GraphRelationType {
    if (this.relationTypesById[props.id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    this.relationTypesById[props.id] = { ...props };
    return this.relationTypesById[props.id];
  }

  updateRelationType(id: string, props: Partial<Omit<GraphRelationType, "id">>): GraphRelationType {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    Object.assign(this.relationTypesById[id], { ...props, id });
    return this.relationTypesById[id];
  }

  deleteRelationType(id: string) {
    // find all relations with this type and set them to a default type
    this.relations.forEach((r) => {
      r.updateType(this.relationTypesById.child);
    });
    delete this.relationTypesById[id];
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

  loadFromServer(data: Awaited<ReturnType<RemoteGraphStore["load"]>>) {
    this.isLoading = true;
    try {
      const { nodes, relationTypes, relations } = data;
      nodes.forEach((n: PersistedGraphNode) => {
        this.createNode({ id: n.id, content: [{ type: "text", value: n.text }] });
      });
      relationTypes.forEach((rt: GraphRelationType) => this.createRelationType(rt, true));
      // TODO: clean up logic elsewhere so "child" type isn't hardcoded
      if (!this.relationTypesById.child) {
        this.createRelationType({ id: "child", label: "child", reverseLabel: "parent" });
      }
      relations.forEach((r: PersistedGraphRelation) => {
        const from = this.getNode(r.fromId);
        const to = this.getNode(r.toId);
        const type = this.relationTypesById[r.typeId as keyof typeof this.relationTypesById]; // TODO
        if (!from || !to || !type) {
          throw new Error("Invalid persisted relation");
        }
        this.createRelation({ from, to, type });
      });
    } catch (e) {
      console.error(e);
    }
    this.isLoading = false;
  }

  createBullet({ parent, relation }: { parent?: Bullet; relation: GraphRelation }) {
    // Create bullet
    const bullet = new Bullet(this, relation, { parent });
    this.bulletsById.set(bullet.id, bullet);

    // Add to index by relation id
    const bullets = this.bulletsByRelationId.get(bullet.graphRelation.id) || new Map();
    bullets.set(bullet.id, bullet);
    this.bulletsByRelationId.set(bullet.graphRelation.id, bullets);

    // Add to parent's children
    parent?.childrenByRelationId.set(relation.id, bullet);

    return bullet;
  }

  /**
   * Delete a bullet and all descendent bullets recursively.
   * Does not delete the node or relation it represents.
   */
  deleteBulletAndDescendantsOnly(bulletId: string) {
    const bullet = this.bulletsById.get(bulletId);
    if (!bullet) return;

    // Delete all children
    bullet.childrenByRelationId.forEach((child) => this.deleteBulletAndDescendantsOnly(child.id));
    bullet.pinnedByRelationId.forEach((child) => this.deleteBulletAndDescendantsOnly(child.id));
    bullet.childrenByRelationId.clear();
    bullet.pinnedByRelationId.clear();

    // Remove reference to bullet from their parent
    bullet.parent?.childrenByRelationId.delete(bullet.graphRelation.id);
    bullet.parent?.pinnedByRelationId.delete(bullet.graphRelation.id);

    // Remove bullets from index by relation id
    const bulletsOfSameRelation = this.bulletsByRelationId.get(bullet.graphRelation.id);
    bulletsOfSameRelation?.delete(bullet.id);
    if (bulletsOfSameRelation?.size === 0) {
      this.bulletsByRelationId.delete(bullet.graphRelation.id);
    }

    // Delete the bullet itself
    this.bulletsById.delete(bullet.id);
  }

  /**
   * By default, deletes a bullet by deleting the relation it represents.
   * If {@link removingNodeAsDirectChildOfThoughtstreamDeletesIt} is enabled,
   * and the bullet is a direct child of the thoughtstream, delete node
   * entirely (which deletes all relations and bullets associated with it).
   */
  deleteBulletByDeletingRelationOrNode(bulletId: string) {
    const bullet = this.bulletsById.get(bulletId);
    if (!bullet) return;
    if (
      this.removingNodeAsDirectChildOfThoughtstreamDeletesIt &&
      bullet.parent?.id === this.thoughtstreamBulletRoot.id
    ) {
      this.deleteNode(bullet.graphNode.id);
    } else {
      this.deleteRelation(bullet.graphRelation);
    }
  }

  moveBulletToNewParent({
    parent,
    bullets,
    target,
  }: {
    parent: Bullet;
    bullets: Bullet[];
    target?: Bullet | "top" | "bottom";
  }) {
    const parentBullet = parent;
    const parentGraphNode = parentBullet.graphNode;
    this.updateRelationFrom(
      bullets.map((b) => b.graphRelation),
      parentGraphNode,
    );
    if (target) {
      parentGraphNode.allRelationsList.move(
        bullets.map((b) => b.graphRelation),
        typeof target === "string" ? target : target.graphRelation,
      );
    }
    // We need to manually add the bullets to the respective maps because otherwise new bullets
    // will be created to reflect the new relations, and we'll lose things like the expanded states
    // underneath and focus state.
    // (TODO: This seems more complicated than it should be though. It's worth revisiting.)
    bullets.forEach((b) => {
      // Remove from old parent
      b.parent?.childrenByRelationId.delete(b.graphRelation.id);
      b.parent?.pinnedByRelationId.delete(b.graphRelation.id);

      // Add to new parent
      b.parent = parentBullet;
      if (target instanceof Bullet && target.isPinned) {
        parentGraphNode.pinnedRelationsList.add(b.graphRelation);
        parentBullet.pinnedByRelationId.set(b.graphRelation!.id, b);
      } else {
        parentBullet.childrenByRelationId.set(b.graphRelation!.id, b);
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
        }
        if (idx === endIndex) {
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
}
