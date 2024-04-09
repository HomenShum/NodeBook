import { action, makeAutoObservable } from "mobx";
import { Position, comparePositions, uuid } from "../util";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { GraphStore, defaultRelationTypes } from "./GraphStore";

export class Bullet {
  public type: "bullet" | "bundle" = "bullet";

  private graphStore: GraphStore;

  public id: string;

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

  get graphNode(): GraphNode {
    if (!this.parent) return this.graphRelation.to;
    return this.graphRelation.from.id === this.parent.graphNode.id ? this.graphRelation.to : this.graphRelation.from;
  }

  setReplacing(replacing: boolean) {
    this.replacing = replacing;
    this.isExpanded = false;
  }

  togglePinnedExpanded() {
    this.isPinnedExpanded = !this.isPinnedExpanded;
  }

  toggleAllRelationsExpanded() {
    this.isAllRelationsExpanded = !this.isAllRelationsExpanded;
  }

  createChild(props: GraphNodeProps = {}) {
    const node = this.graphStore.createNode(props);
    const relation = this.graphStore.createRelation({
      from: this.graphNode,
      to: node,
      type: defaultRelationTypes.child,
    });
    const bullet = this.graphStore.createBullet({ parent: this, relation });
    const result: {
      bullet: Bullet;
      bundleRelations: GraphRelation[];
      outlineRelation?: GraphRelation;
      thoughtstreamRelation?: GraphRelation;
    } = { bullet, bundleRelations: [] };
    // TODO: this doesn't belong here. like you can create nodes and relations
    // in lot of different places but this is the only place where it'd add
    // to the outline / thoughtstream view
    const rootAncestor = bullet.ancestors[0]?.id;
    const directAncestor = bullet.parent?.id;
    if (rootAncestor === this.graphStore.thoughtstreamBulletRoot.id) {
      // Inside thoughtstream
      const isDirectChild = directAncestor === this.graphStore.thoughtstreamBulletRoot.id;
      if (isDirectChild && this.graphStore.addThoughstreamDirectChildrenToOutline) {
        result.outlineRelation = this.graphStore.createRelation({
          from: this.graphStore.outlineRoot,
          to: node,
          type: defaultRelationTypes.child,
        });
      } else if (!isDirectChild && this.graphStore.addThoughtstreamNestedChildrenToThoughtstream) {
        result.thoughtstreamRelation = this.graphStore.createRelation({
          from: this.graphStore.thoughtstreamRoot,
          to: node,
          type: defaultRelationTypes.child,
        });
      }
    } else if (rootAncestor === this.graphStore.outlineBulletRoot.id) {
      // Inside outline
      if (this.graphStore.addAllOutlineDescendantsToThoughtstream) {
        result.thoughtstreamRelation = this.graphStore.createRelation({
          from: this.graphStore.thoughtstreamRoot,
          to: node,
          type: defaultRelationTypes.child,
        });
      }
    }
    return result;
  }

  isRelationToThis() {
    return this.graphRelation?.to.id === this.graphNode.id;
  }

  setType(type: "bullet" | "bundle") {
    this.type = type;
    if (type === "bullet" && this.isExpanded) {
      this.updateChildren();
    }
  }

  setRelation(relation: GraphRelation) {
    this.graphRelation = relation;
  }

  /**
   * Update children to match the relations of the graph node.
   *
   * We do this lazily when the bullet is expanded, to avoid needing to
   * create and maintain every possible tree of bullets that the current
   * graph can represent.
   */
  updateChildren() {
    const relations = this.graphNode.relations;
    // remove children that are no longer in the relations
    const relationIds = new Set(relations.map((r) => r.id));
    this.childrenByRelationId.forEach((child, id) => {
      if (!relationIds.has(id)) {
        this.childrenByRelationId.delete(id);
        this.graphStore.deleteBulletAndDescendantsOnly(child.id);
      }
    });
    this.pinnedByRelationId.forEach((child, id) => {
      if (!relationIds.has(id)) {
        this.pinnedByRelationId.delete(id);
      }
    });
    // add children that are in the relations but not in the children
    relations.forEach((relation) => {
      if (this.childrenByRelationId.has(relation.id)) return;
      this.childrenByRelationId.set(
        relation.id,
        this.graphStore.createBullet({
          parent: this,
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
    return this.graphNode.relationsWithPositions
      .map(({ relation, position }) => {
        const bullet = this.childrenByRelationId.get(relation.id);
        // TODO: weird that this can every happen, and that we need to do this
        if (!bullet) {
          console.error("missing bullet for relation", {
            parentBulletId: this.id,
            parentGraphNodeId: this.graphNode.id,
            parentText: this.graphNode.text,
          });
          return;
        }
        return { bullet, position };
      })
      .filter((x) => x) as { bullet: Bullet; position: Position }[];
  }

  get children() {
    return this.childrenWithPositions.map(({ bullet }) => bullet);
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
        const newBullet = new Bullet(this.graphStore, relation, { parent: this });
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

  clearChildrenAndCollapse() {
    this.childrenByRelationId.forEach((child) => this.graphStore.deleteBulletAndDescendantsOnly(child.id));
    this.childrenByRelationId.clear();
    this.pinnedByRelationId.forEach((child) => this.graphStore.deleteBulletAndDescendantsOnly(child.id));
    this.pinnedByRelationId.clear();
    this.isExpanded = false;
  }

  setGraphNode(graphNode: GraphNode) {
    if (!this.isRelationToThis()) {
      console.error("Can't set graph node on backrelation bullet");
      return;
    }
    this.graphStore.updateRelationTo([this.graphRelation], graphNode);
    this.graphStore.bulletsByRelationId.get(this.graphRelation.id)?.forEach((b) => {
      b.clearChildrenAndCollapse();
    });
  }

  moveAfterSibling(sibling: Bullet) {
    if (this.isPinned) {
      this.parent?.graphNode.pinnedRelationsList.move([this.graphRelation], sibling.graphRelation);
    } else {
      this.parent?.graphNode.allRelationsList.move([this.graphRelation], sibling.graphRelation);
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
    this.parent?.graphNode.pinnedRelationsList.add(this.graphRelation);
  }

  unpin() {
    this.parent?.graphNode.pinnedRelationsList.delete(this.graphRelation.id);
  }

  siblingBundlesThisNodeIsChildOf() {
    const siblingBundles = this.parent?.children.filter((b) => b.type === "bundle") ?? [];
    return siblingBundles.filter((b) => b.graphNode.relatedNodes.map((n) => n.id).includes(this.graphNode.id));
  }
}
