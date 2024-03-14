import { makeAutoObservable } from "mobx";
import { uuid } from "../util";
import { GraphNode } from "./GraphNode";
import { ViewStore } from "./ViewStore";
import { GraphNodeView, GraphNodeViewType } from "./GraphNodeView";
import { GraphRelation } from "./GraphRelation";

export class Note implements GraphNodeView {
  public type: GraphNodeViewType = "note";

  private viewStore: ViewStore;

  public id: string;

  public graphNode: GraphNode;

  private childrenByRelationId: Map<string, Note[]>;
  private childrenIds: Set<string>;

  constructor(
    store: ViewStore,
    node: GraphNode,
    {
      id,
    }: {
      id?: string;
    } = {}
  ) {
    this.viewStore = store;
    this.graphNode = node;
    this.id = id ?? uuid();
    this.childrenByRelationId = new Map();
    this.childrenIds = new Set();
    makeAutoObservable(this);
  }

  gatherChildrenFromRelation(relation: GraphRelation): Note[] {
    if (relation.type.id != "child") return [];

    const existing = this.childrenByRelationId.get(relation.id);
    if (existing) {
      return existing;
    }

    // Set this early to prevent infinite recursion
    this.childrenByRelationId.set(relation.id, []);

    const childNode = relation.to;
    if (this.childrenIds.has(childNode.id)) {
      // We've already added this child, so we don't need to do anything
      return [];
    }
    this.childrenIds.add(childNode.id);

    const childrenAsNotes: Note[] = [];
    const childAsNote = new Note(this.viewStore, childNode);
    childrenAsNotes.push(childAsNote);
    childNode.relations.forEach((childRelation) => {
      const furtherDescendents = this.gatherChildrenFromRelation(childRelation);
      childrenAsNotes.push(...furtherDescendents);
    });

    this.childrenByRelationId.set(relation.id, childrenAsNotes);
    return childrenAsNotes;
  }

  get children() {
    console.log("children");
    const children: Note[] = [];
    this.graphNode.relations.forEach((relation) => {
      children.push(...this.gatherChildrenFromRelation(relation));
    });
    return children;
  }

  get isFocused() {
    return this.viewStore.focusedNode?.id === this.id;
  }
}
