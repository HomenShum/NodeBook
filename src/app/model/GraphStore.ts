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
  bulletsById: Map<string, Bullet> = new Map();
  // TODO: do we need this? feels like there could be multiple
  outlineBulletRoot: Bullet | null = null;
  thoughtstreamBulletRoot: Bullet;

  isLoading = false;
  remote?: RemoteGraphStore;
  public relationTypesById: Record<string, GraphRelationType> = {};

  userRoot: GraphNode;
  outlineRoot: GraphNode;

  thoughtstreamRoot: GraphNode;
  outlineRootRelationToUserRoot: GraphRelation;
  thoughtstreamRootRelationToUserRoot: GraphRelation;

  constructor(remote?: RemoteGraphStore) {
    this.remote = remote;
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
      node: this.outlineRoot,
      relation: this.outlineRootRelationToUserRoot,
    });
    this.thoughtstreamBulletRoot = this.createBullet({
      node: this.thoughtstreamRoot,
      relation: this.thoughtstreamRootRelationToUserRoot,
    });
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
    const node = new GraphNode(this, this.remote ?? null, {
      id: props.id || uuid(),
      content: props.content,
    });
    this.nodesById.set(node.id, node);
    // if (!fromServer && this.remote) {
    //   this.remote.upsertNode(node.id, node.text, node.thoughtstreamPosition);
    // }
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
    this.relationsById.delete(relation.id);
    fromNode.allRelationsById.delete(relation.id);
    fromNode.pinnedRelationsById.delete(relation.id);
    toNode.allRelationsById.delete(relation.id);
    toNode.pinnedRelationsById.delete(relation.id);
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
      oldFrom.allRelationsById.delete(r.id);
      oldFrom.pinnedRelationsById.delete(r.id);
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
      oldTo.allRelationsById.delete(r.id);
      oldTo.pinnedRelationsById.delete(r.id);
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
    if (this.relationTypesById[props.id] && !fromServer) {
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
    if (!this.remote) {
      console.warn("Tried to load from server without remote store");
      return;
    }
    this.isLoading = true;
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
    this.isLoading = false;
  }

  addNodeFromServer(persistedNode: PersistedGraphNode) {
    const node = this.createNode(
      { id: persistedNode.id, content: [{ type: "text", value: persistedNode.text }] },
      { fromServer: true },
    );
    if (node.id === OUTLINE_ROOT_ID) {
      this.outlineRoot = node;
    } else if (node.id === THOUGHTSTREAM_ROOT_ID) {
      this.thoughtstreamRoot = node;
    } else if (node.id === USER_ROOT_ID) {
      this.userRoot = node;
    }
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

  setCurrentOutlineViewRoot(bullet: Bullet) {
    this.outlineBulletRoot = bullet;
  }

  createBullet({ parent, node, relation }: { parent?: Bullet; node: GraphNode; relation: GraphRelation }) {
    const bullet = new Bullet(this, node, relation, { parent });
    this.bulletsById.set(bullet.id, bullet);
    parent?.childrenByRelationId.set(relation.id, bullet);
    return bullet;
  }

  deleteBullet(bullet: Bullet) {
    this.deleteRelation(bullet.graphRelation!);
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
    this.updateRelationFrom(
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

  setGraphNodeOnBullet(bullet: Bullet, graphNode: GraphNode) {
    if (bullet.isRelationToThis()) {
      this.updateRelationTo({ newTo: graphNode }, bullet.graphRelation!);
    } else {
      this.updateRelationFrom({ newFrom: graphNode }, bullet.graphRelation!);
    }
    bullet.graphNode = graphNode;
  }
}
