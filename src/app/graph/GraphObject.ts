import { PositionedRelation } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { comparePositions } from "@/app/util";

import { GraphRelation } from "./GraphRelation";

export abstract class GraphObject {
  abstract objectType: "node" | "relation" | "placeholder";
  abstract id: string;
  abstract authorId: string;
  abstract createdAt: Date;
  abstract text: string;
  abstract isPrivate: boolean;
  protected store: GraphStore;

  constructor(store: GraphStore) {
    this.store = store;
  }

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
  }

  connectedObjects(): GraphObject[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  setIsPrivate(value: boolean) {
    this.isPrivate = value;
  }

  get isRoot() {
    return (
      this.id === this.store.thoughtstreamRoot.id ||
      this.id === this.store.outlineRoot.id ||
      this.id === this.store.userRoot.id
    );
  }

  get allRelationsList() {
    const list = this.store.relationsByNodeId.get(this.id);
    if (!list) throw new Error("Missing allRelationsList");
    return list;
  }

  get pinnedRelationsList() {
    const list = this.store.pinnedRelationsByNodeId.get(this.id);
    if (!list) throw new Error("Missing pinnedRelationsList");
    return list;
  }

  get relationsWithPositions(): PositionedRelation[] {
    const list = this.store.relationsByNodeId.get(this.id);
    if (!list) return [];
    return list.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get relations(): GraphRelation[] {
    return this.relationsWithPositions.map(({ relation }) => relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return this.relationsWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ relation }) => relation);
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  /**
   * Loosely speaking, locality is a property that tells you whether an object
   * appears in one or many places in the graph. This is used to determine
   * whether we render an object to the user as an editable value (like a string
   * or number) or as a reference (like a link or a mention).
   */
  get locality(): "local" | "global" {
    if (
      this.id === this.store.thoughtstreamRoot.id ||
      this.id === this.store.outlineRoot.id ||
      this.id === this.store.userRoot.id
    ) {
      return "global";
    }
    // Common case: you add the first labelled child
    const relationsFromThis = this.relations.filter((r) => r.from.id === this.id);
    if (relationsFromThis.some((r) => r.isLabelled())) {
      return "global";
    }
    // Common case: you create a lablled relation to this, and then add a child
    // to it
    const labelledRelationsToThis = this.relations.some((r) => r.isLabelled() && r.to.id === this.id);
    if (labelledRelationsToThis && relationsFromThis.length > 0) {
      return "global";
    }
    return "local";
  }

  /**
   * See {@link locality}.
   */
  get isLocal() {
    return this.locality === "local";
  }

  /**
   * See {@link locality}.
   */
  get isGlobal() {
    return this.locality === "global";
  }

  pinChildRelation(childRelation: GraphRelation | GraphRelation[], after?: Positioner<GraphRelation>) {
    const relationIds = Array.isArray(childRelation) ? childRelation.map((r) => r.id) : [childRelation.id];
    this.store.pinRelations(this.id, relationIds, after);
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.store.unpinRelations(this.id, [childRelation.id]);
  }

  isRelationPinned(childRelation: GraphRelation) {
    return this.pinnedRelationsList.has(childRelation.id);
  }
}
