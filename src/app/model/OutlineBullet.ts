import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode } from "./GraphNode";
import { GraphRelation } from "./GraphRelation";
import { OutlineViewStore } from "./OutlineViewStore";

export class Bullet {
  private outlineViewStore: OutlineViewStore;
  // we need this in addition to the relation because the root node has no relation
  // (maybe we should just special case the root node?)
  public graphNode: GraphNode;
  // TODO I should make this not nullable somehow
  public graphRelation: GraphRelation | null;
  public parent: Bullet | null;
  public isExpanded: boolean;
  public childrenByRelationId: Map<string, Bullet>;
  public id: string;
  constructor(
    store: OutlineViewStore,
    node: GraphNode,
    relation: GraphRelation | null = null,
    parent: Bullet | null = null,
    {
      isExpanded,
      childrenByRelationId,
      id,
    }: {
      isExpanded?: boolean;
      childrenByRelationId?: Map<string, Bullet>;
      id?: string;
    } = {}
  ) {
    this.outlineViewStore = store;
    this.graphNode = node;
    this.graphRelation = relation;
    this.parent = parent;
    this.isExpanded = isExpanded ?? false;
    this.childrenByRelationId = childrenByRelationId ?? new Map();
    this.id = id ?? uuid();
    makeAutoObservable(this);
  }

  insertGraphNode(node: GraphNode, relation: GraphRelation) {
    return this.outlineViewStore.insertGraphNodeToOutline(node, relation, this);
  }

  createChild() {
    return this.outlineViewStore.createNode(this);
  }

  delete() {
    this.outlineViewStore.deleteNode(this);
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  get isFocused() {
    return this.outlineViewStore.focusedNode?.id === this.id;
  }

  get parents() {
    const parents: Bullet[] = [];
    let current: Bullet = this;
    while (current.parent) {
      parents.unshift(current.parent);
      current = current.parent;
    }
    return parents;
  }

  get children() {
    const newChildren: Bullet[] = [];
    this.graphNode.relations.forEach((relation) => {
      const existing = this.childrenByRelationId.get(relation.id);
      if (existing) {
        newChildren.push(existing);
      } else {
        const relatedNode =
          relation.to.id === this.graphNode.id ? relation.from : relation.to;
        const newBullet = new Bullet(
          this.outlineViewStore,
          relatedNode,
          relation,
          this
        );
        newChildren.push(newBullet);
        this.childrenByRelationId.set(relation.id, newBullet);
      }
    });
    return newChildren;
  }
}
