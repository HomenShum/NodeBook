import { action, makeAutoObservable } from "mobx";
import { Position, comparePositions, generateDefaultPosition, generatePositionBetween, uuid } from "../util";
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
      setIsExpanded: action,
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
    this.graphStore.deleteRelation(this.graphRelation);
    this.graphStore.deleteBullet(this);
  }

  /**
   * Update children to match the relations of the graph node.
   *
   * We do this lazily when the bullet is expanded, to avoid needing to
   * create and maintain every possible tree of bullets that the current
   * graph can represent.
   */
  updateChildren() {
    this.graphNode.relations.forEach((relation) => {
      if (this.childrenByRelationId.has(relation.id)) return;
      this.childrenByRelationId.set(
        relation.id,
        this.graphStore.createBullet({
          parent: this,
          node: relation.to.id === this.graphNode.id ? relation.from : relation.to,
          relation,
        }),
      );
    });
  }

  toggleExpanded() {
    this.setIsExpanded(!this.isExpanded);
  }

  setIsExpanded(expanded: boolean) {
    if (expanded) {
      this.updateChildren();
    }
    this.isExpanded = expanded;
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
    if (!this.isExpanded) {
      // TODO add more comments explaining, and referring to https://mobx.js.org/computeds.html#rules
      throw new Error(
        `Can't access children of unexpanded bullet. Children are lazily updated when you expand a bullet, so expand the bullet first, then access the children.`,
      );
    }
    return Array.from(this.childrenByRelationId.values())
      .map((bullet) => {
        const position = this.graphNode.allRelationsById.get(bullet.graphRelation.id)?.position;
        // TODO: weird that this can every happen, and that we need to do this
        if (!position) {
          console.error("missing position for relation", bullet.graphRelation);
        }
        return { bullet, position };
      })
      .filter(({ position }) => position) as { bullet: Bullet; position: Position }[];
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
