import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode } from "./GraphNode";
import { GraphNodeView, GraphNodeViewType } from "./GraphNodeView";
import { GraphRelation } from "./GraphRelation";
import { OutlineViewStore } from "./OutlineViewStore";

export class Bullet implements GraphNodeView {
  public type: GraphNodeViewType = "bullet";

  private viewStore: OutlineViewStore;

  public id: string;

  // we need this in addition to the relation because the root node has no relation
  // (maybe we should just special case the root node?)
  public graphNode: GraphNode;
  // TODO I should make this not nullable somehow
  public graphRelation: GraphRelation | null;
  public parent: Bullet | null;
  public isExpanded: boolean;
  public isPinnedExpanded: boolean;
  public isAllRelationsExpanded: boolean;
  public childrenByRelationId: Map<string, Bullet>; // TODO rename
  public pinnedByRelationId: Map<string, Bullet>;

  constructor(
    store: OutlineViewStore,
    node: GraphNode,
    {
      relation,
      parent,
      isExpanded,
      id,
    }: {
      relation?: GraphRelation;
      parent?: Bullet;
      isExpanded?: boolean;
      id?: string;
    } = {},
  ) {
    this.viewStore = store;
    this.graphNode = node;
    this.graphRelation = relation ?? null;
    this.parent = parent ?? null;
    this.isExpanded = isExpanded ?? false;
    this.id = id ?? uuid();
    this.childrenByRelationId = new Map();
    this.pinnedByRelationId = new Map();
    this.isPinnedExpanded = true;
    this.isAllRelationsExpanded = true;

    makeAutoObservable(this, {
      childrenByRelationId: false,
    });
  }

  togglePinnedExpanded() {
    this.isPinnedExpanded = !this.isPinnedExpanded;
  }

  toggleAllRelationsExpanded() {
    this.isAllRelationsExpanded = !this.isAllRelationsExpanded;
  }

  createRelatedBullet(props: Parameters<typeof GraphNode.prototype.createRelatedNode>[0] = {}): Bullet {
    const { node, relation } = this.graphNode.createRelatedNode(props);
    const bullet = new Bullet(this.viewStore, node, { relation, parent: this });
    this.childrenByRelationId.set(relation.id, bullet);
    return bullet;
  }

  isRelationToThis() {
    return this.graphRelation?.to.id === this.graphNode.id;
  }

  setRelation(relation: GraphRelation) {
    this.graphRelation = relation;
  }

  setGraphNode(graphNode: GraphNode) {
    this.viewStore.setGraphNodeOnBullet(this, graphNode);
  }

  delete() {
    this.viewStore.deleteNode(this);
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  get isFocused() {
    return this.viewStore.focusedNode?.id === this.id;
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

  get children(): Bullet[] {
    return this.graphNode.relationsWithPositions.map(({ relation }) => {
      const existingBullet = this.childrenByRelationId.get(relation.id);
      if (existingBullet) {
        return existingBullet;
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newBullet = new Bullet(this.viewStore, relatedNode, { relation, parent: this });
        this.childrenByRelationId.set(relation.id, newBullet);
        return newBullet;
      }
    });
  }

  get pinnedChildren(): Bullet[] {
    return this.graphNode.pinnedRelationsWithPositions.map(({ relation }) => {
      const existingBullet = this.pinnedByRelationId.get(relation.id);
      if (existingBullet) {
        return existingBullet;
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newBullet = new Bullet(this.viewStore, relatedNode, { relation, parent: this });
        this.pinnedByRelationId.set(relation.id, newBullet);
        return newBullet;
      }
    });
  }

  get position(): string {
    const relationId = this.graphRelation?.id ?? "";
    const position = this.parent?.graphNode.allRelationsById.get(relationId)?.position;
    if (!position) throw new Error(`Relation not found in parent's allRelationsById map`);
    return position;
  }

  set position(position: string) {
    const positionedRelation = this.parent?.graphNode.allRelationsById.get(this.graphRelation!.id);
    if (!positionedRelation) throw new Error(`Relation not found in parent's allRelationsById map`);
    positionedRelation.position = position;
  }

  get pinnedPosition(): string | null {
    const relationId = this.graphRelation?.id;
    if (!relationId) return null;
    return this.parent?.graphNode.pinnedRelationsById.get(relationId)?.position ?? null;
  }

  get isPinned() {
    return this.parent?.graphNode.pinnedRelationsById.has(this.graphRelation!.id) ?? false;
  }

  pin() {
    this.parent?.graphNode.pinRelation({}, this.graphRelation!);
  }

  unpin() {
    this.parent?.graphNode.unpinRelation(this.graphRelation!);
  }
}
