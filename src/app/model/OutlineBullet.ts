import { generateNKeysBetween } from "fractional-indexing";
import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode, GraphNodeProps } from "./GraphNode";
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
  public childrenByRelationId: Map<string, Bullet>;
  public position: string;

  constructor(
    store: OutlineViewStore,
    node: GraphNode,
    relation: GraphRelation | null = null,
    parent: Bullet | null = null,
    {
      isExpanded,
      id,
      position,
    }: {
      isExpanded?: boolean;
      id?: string;
      position?: string;
    } = {},
  ) {
    this.viewStore = store;
    this.graphNode = node;
    this.graphRelation = relation;
    this.parent = parent;
    this.isExpanded = isExpanded ?? false;
    this.position = position ?? "a0"; // TODO
    this.childrenByRelationId = new Map();

    this.id = id ?? uuid();
    makeAutoObservable(this);
  }

  isRelationToThis() {
    return this.graphRelation?.to.id === this.graphNode.id;
  }

  setRelation(relation: GraphRelation) {
    this.graphRelation = relation;
  }

  insertGraphNode(graphNode: GraphNode, relation: GraphRelation) {
    return this.viewStore.insertGraphNodeToOutline({
      graphNode,
      relation,
      parent: this,
    });
  }

  createChild(props: GraphNodeProps = {}, position?: string) {
    const { child, relation } = this.graphNode.createChild(props);
    return this.viewStore.insertGraphNodeToOutline({
      graphNode: child,
      relation,
      parent: this,
      position,
    });
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

  get children() {
    const children: Bullet[] = [];
    const newChildren: Bullet[] = [];

    this.graphNode.relations.forEach((relation) => {
      const existing = this.childrenByRelationId.get(relation.id);
      if (existing) {
        children.push(existing);
      } else {
        const relatedNode = relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newBullet = new Bullet(this.viewStore, relatedNode, relation, this);
        newChildren.push(newBullet);
      }
    });
    // Add the new children positioned after the last existing child
    const lastPosition = children[children.length - 1]?.position ?? null;
    const positions = generateNKeysBetween(null, lastPosition, newChildren.length);
    newChildren.forEach((child, i) => {
      child.position = positions[i];
      children.push(child);
      this.childrenByRelationId.set(child.graphRelation!.id, child);
    });
    return children;
  }

  get lastChild() {
    const sortedChildren = this.children.sort(sortBullets);
    return sortedChildren[sortedChildren.length - 1];
  }
}

export function sortBullets(a: Bullet, b: Bullet) {
  return a.position < b.position ? -1 : 1;
}
