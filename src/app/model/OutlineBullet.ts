import { makeAutoObservable } from "mobx";
import { comparePositions, generateDefaultPosition, generatePositionBetween, uuid } from "../util";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { GraphStore, THOUGHTSTREAM_ROOT_ID, defaultRelationTypes } from "./GraphStore";

export class Bullet {
  public type: "bullet" | "bundle" = "bullet";

  private graphStore: GraphStore;

  public id: string;

  // we need this in addition to the relation because the root node has no relation
  // (maybe we should just special case the root node?)
  public graphNode: GraphNode;
  // TODO I should make this not nullable somehow
  public graphRelation: GraphRelation;
  public parent: Bullet | null;
  public isExpanded: boolean;
  public isPinnedExpanded: boolean;
  public isAllRelationsExpanded: boolean;
  public childrenByRelationId: Map<string, Bullet>; // TODO rename
  public pinnedByRelationId: Map<string, Bullet>;
  public replacing = false;

  constructor(
    graphStore: GraphStore,
    node: GraphNode,
    relation: GraphRelation,
    {
      parent,
      isExpanded = false,
      id,
    }: {
      parent?: Bullet;
      isExpanded?: boolean;
      id?: string;
    } = {},
  ) {
    this.graphStore = graphStore;
    this.graphNode = node;
    this.graphRelation = relation;
    this.parent = parent ?? null;
    this.isExpanded = isExpanded;
    this.id = id ?? uuid();
    this.childrenByRelationId = new Map();
    this.pinnedByRelationId = new Map();
    this.isPinnedExpanded = true;
    this.isAllRelationsExpanded = true;
    makeAutoObservable(this, {
      childrenByRelationId: false,
    });
  }

  setReplacing(replacing: boolean) {
    this.replacing = replacing;
  }

  togglePinnedExpanded() {
    this.isPinnedExpanded = !this.isPinnedExpanded;
  }

  toggleAllRelationsExpanded() {
    this.isAllRelationsExpanded = !this.isAllRelationsExpanded;
  }

  createChild(props: GraphNodeProps = {}): Bullet {
    const node = this.graphStore.createNode(props);
    const relation = this.graphStore.createRelation({
      from: this.graphNode,
      to: node,
      type: defaultRelationTypes.child,
    });
    // TODO: this doesn't belong here. like you can create nodes and relations
    // in lot of different places but this is the only place where it'd add
    // to the outline / thoughtstream view
    if (this.graphNode.id === THOUGHTSTREAM_ROOT_ID) {
      this.graphStore.createRelation({
        from: this.graphStore.outlineRoot,
        to: node,
        type: defaultRelationTypes.child,
      });
    } else {
      this.graphStore.createRelation({
        from: this.graphStore.thoughtstreamRoot,
        to: node,
        type: defaultRelationTypes.child,
      });
    }
    return this.graphStore.createBullet({ parent: this, node, relation });
  }

  isRelationToThis() {
    return this.graphRelation?.to.id === this.graphNode.id;
  }

  setType(type: "bullet" | "bundle") {
    this.type = type;
  }

  setRelation(relation: GraphRelation) {
    this.graphRelation = relation;
  }

  setGraphNode(graphNode: GraphNode) {
    this.graphStore.setGraphNodeOnBullet(this, graphNode);
  }

  delete() {
    this.graphStore.deleteBullet(this);
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  get ancestors() {
    const parents: Bullet[] = [];
    let current: Bullet = this;
    while (current.parent) {
      parents.unshift(current.parent);
      current = current.parent;
    }
    return parents;
  }

  get childrenWithPositions() {
    return this.graphNode.relationsWithPositions.map(({ relation, position }) => {
      const bullet = this.childrenByRelationId.get(relation.id);
      if (bullet) {
        return { bullet, position };
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        // TODO should use createBullet
        const newBullet = new Bullet(this.graphStore, relatedNode, relation, { parent: this });
        this.childrenByRelationId.set(relation.id, newBullet);
        return { bullet: newBullet, position };
      }
    });
  }

  get childrenSortedByPosition(): Bullet[] {
    return this.childrenWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ bullet }) => bullet);
  }

  get pinnedChildrenWithPositions() {
    return this.graphNode.pinnedRelationsWithPositions.map(({ relation, position }) => {
      const bullet = this.pinnedByRelationId.get(relation.id);
      if (bullet) {
        return { bullet, position };
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newBullet = new Bullet(this.graphStore, relatedNode, relation, { parent: this });
        this.pinnedByRelationId.set(relation.id, newBullet);
        return { bullet: newBullet, position };
      }
    });
  }

  get pinnedChildrenSortedByPosition(): Bullet[] {
    return this.pinnedChildrenWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ bullet }) => bullet);
  }

  moveAfterSibling(sibling: Bullet) {
    const parent = this.parent;
    if (!parent) {
      throw new Error("Bullet has no parent");
    }
    const graphRelation = this.graphRelation;
    if (!graphRelation) {
      throw new Error("Bullet has no relation");
    }
    if (this.isPinned) {
      const relations =
        parent.graphNode.pinnedRelationsWithPositions.sort((a, b) => comparePositions(a.position, b.position)) ?? [];
      const index = relations.findIndex((r) => r.relation.id === sibling.graphRelation?.id);
      if (index === -1) {
        throw new Error("Bullet is not a sibling");
      }
      const posBefore = relations[index]?.position;
      const posAfter = relations[index + 1]?.position ?? null;
      const newPosition = posBefore
        ? generatePositionBetween(posBefore, posAfter)
        : generateDefaultPosition(graphRelation.createdAt);
      const positionedRelation = parent.graphNode.pinnedRelationsById.get(graphRelation.id);
      if (!positionedRelation) {
        throw new Error("Relation not found");
      }
      positionedRelation.position = newPosition;
    } else {
      const relations = parent.graphNode.relationsWithPositions.sort((a, b) =>
        comparePositions(a.position, b.position),
      );
      const index = relations.findIndex((r) => r.relation.id === sibling.graphRelation?.id);
      if (index === -1) {
        throw new Error("Bullet is not a sibling");
      }
      const relationAfter = relations[index + 1];
      const posBefore = relations[index].position;
      const posAfter = relationAfter?.position ?? null;
      const newPosition = posBefore
        ? generatePositionBetween(posBefore, posAfter)
        : generateDefaultPosition(graphRelation.createdAt);
      const positionedRelation = parent.graphNode.allRelationsById.get(graphRelation.id);
      if (!positionedRelation) {
        throw new Error("Relation not found");
      }
      positionedRelation.position = newPosition;
    }
  }

  // TODO this feels awkward, and like it shouldn't be necessary
  get isPinned() {
    return Array.from(this.parent?.pinnedByRelationId.values() ?? [])
      .map((b) => b.id)
      .includes(this.id);
  }

  get isParent() {
    return this.graphRelation.type.id === defaultRelationTypes.child.id && !this.isRelationToThis();
  }

  pin() {
    this.parent?.graphNode.pinRelation({}, this.graphRelation!);
  }

  unpin() {
    this.parent?.graphNode.unpinRelation(this.graphRelation!);
  }
}
