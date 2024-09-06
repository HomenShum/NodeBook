import { FractionalPositionedList } from "@/app/graph/FractionalPositionedList";
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
  abstract searchText: string;
  abstract isPublic: boolean;
  protected store: GraphStore;
  allRelationsList: FractionalPositionedList<GraphRelation>;
  pinnedRelationsList: FractionalPositionedList<GraphRelation>;

  constructor(store: GraphStore) {
    this.store = store;
    this.allRelationsList = new FractionalPositionedList();
    this.pinnedRelationsList = new FractionalPositionedList();
  }

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
  }

  connectedObjects(): GraphObject[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  get isRoot() {
    return this.id === this.store.userRoot.id || this.id === this.store.globalRoot.id;
  }

  get relationsWithPositions(): PositionedRelation[] {
    return this.allRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
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
    if (this.id === this.store.userRoot.id || this.id === this.store.globalRoot.id) {
      return "global";
    }
    // As soon as you have more than one relation pointing to you, you're global
    const labelledRelations = this.relations.filter((r) => r.isLabelled()).length;
    const unlablledRelationsTo = this.relations.filter((r) => r.to.id === this.id && !r.isLabelled()).length;
    if (labelledRelations > 1 || unlablledRelationsTo > 1) {
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
