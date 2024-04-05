import { generateNKeysBetween } from "fractional-indexing";
import { makeAutoObservable } from "mobx";
import { Position, comparePositions } from "../util";
import { GraphRelation, GraphRelationType } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { RemoteGraphStore } from "./RemoteGraphStore";

export type GraphNodeProps = {
  id?: string;
  text?: string;
};

export type RelativePositionProps = {
  target?: GraphRelation;
  side?: "above" | "below";
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode {
  public id: string;
  public text: string = "";
  public allRelationsById = new Map<string, PositionedRelation>();
  public pinnedRelationsById = new Map<string, PositionedRelation>();
  public createdAt = new Date();

  constructor(
    private store: GraphStore,
    private remote: RemoteGraphStore | null,
    { id, text = "" }: { id: string; text?: string },
  ) {
    this.id = id;
    this.text = text;
    makeAutoObservable(this);
  }

  get isRoot() {
    return (
      this.id === this.store.outlineRoot.id ||
      this.id === this.store.thoughtstreamRoot.id ||
      this.id === this.store.userRoot.id
    );
  }

  get relations(): GraphRelation[] {
    return Array.from(this.allRelationsById.values()).map((r) => r.relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return Array.from(this.allRelationsById.values())
      .sort((a, b) => comparePositions(a.position, b.position))
      .map((r) => r.relation);
  }

  get relationsWithPositions(): PositionedRelation[] {
    return Array.from(this.allRelationsById.values());
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return Array.from(this.pinnedRelationsById.values());
  }

  setText(text: string) {
    this.text = text;
    // if (this.remote) {
    //   this.remote.upsertNode(this.id, text, this.thoughtstreamPosition ?? null);
    // }
  }

  createRelatedNode({
    graphNodeProps,
    relationType = this.store.relationTypesById.child,
    position = { side: "below" },
  }: {
    graphNodeProps?: GraphNodeProps;
    relationType?: GraphRelationType;
    position?: { target?: GraphRelation; side?: "above" | "below" };
  } = {}) {
    const node = this.store.createNode(graphNodeProps);
    const relation = this.store.insertRelation(
      new GraphRelation(this.store, {
        from: this,
        to: node,
        type: relationType,
      }),
    );
    this.insertRelation(position, relation);
    return { node, relation };
  }

  insertRelation({ target, side = "below" }: RelativePositionProps, ...relations: GraphRelation[]) {
    relations.forEach((r) => this.assertValidRelation(r)); // TODO can you have multiple relations with the same id?
    let posBefore: Position | null = null;
    let posAfter: Position | null = null;
    const positionedRelations = Array.from(this.allRelationsById.values()).sort((a, b) =>
      comparePositions(a.position, b.position),
    );
    if (target) {
      // insert relations beside target
      const index = positionedRelations.findIndex((r) => r.relation.id === target.id);
      posBefore = positionedRelations[index]?.position ?? null;
      posAfter = positionedRelations[index + 1]?.position ?? null;
    } else if (side === "above") {
      // insert relations above all other relations
      posBefore = null;
      posAfter = positionedRelations[0]?.position ?? null;
    } else if (side === "below") {
      // insert relations below all other relations
      posBefore = positionedRelations[positionedRelations.length - 1]?.position ?? null;
      posAfter = null;
    }
    const newFractionalPositions = generateNKeysBetween(
      posBefore?.frac ?? null,
      posAfter?.frac ?? null,
      relations.length,
    );
    relations.forEach((relation, i) => {
      this.allRelationsById.set(relation.id, {
        position: { int: posBefore?.int ?? relation.createdAt.getTime(), frac: newFractionalPositions[i] },
        relation,
      });
    });
  }

  pinRelation({ target, side = "below" }: RelativePositionProps, ...insertingRelations: GraphRelation[]) {
    insertingRelations.forEach((r) => this.assertValidRelation(r));
    let posBefore: Position | null = null;
    let posAfter: Position | null = null;
    const pinnedRelations = Array.from(this.pinnedRelationsById.values()).sort((a, b) =>
      comparePositions(a.position, b.position),
    );
    if (target) {
      const index = pinnedRelations.findIndex((r) => r.relation.id === target.id);
      posBefore = pinnedRelations[index]?.position ?? null;
      posAfter = pinnedRelations[index + 1]?.position ?? null;
    } else if (side === "above") {
      posBefore = null;
      posAfter = pinnedRelations[0]?.position ?? null;
    } else if (side === "below") {
      posBefore = pinnedRelations[pinnedRelations.length - 1]?.position ?? null;
      posAfter = null;
    }
    const newFractionalPositions = generateNKeysBetween(
      posBefore?.frac ?? null,
      posAfter?.frac ?? null,
      insertingRelations.length,
    );
    insertingRelations.forEach((relation, i) => {
      this.pinnedRelationsById.set(relation.id, {
        position: { int: posBefore?.int ?? relation.createdAt.getTime(), frac: newFractionalPositions[i] },
        relation,
      });
    });
  }

  unpinRelation(...relations: GraphRelation[]) {
    relations.forEach((r) => this.pinnedRelationsById.delete(r.id));
  }

  delete() {
    this.store.deleteNode(this.id);
  }

  get children(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypesById.child.id && r.from === this)
      .map((r) => r.to);
  }

  get parents(): GraphNode[] {
    return this.relations
      .filter((r) => r.type.id === this.store.relationTypesById.child.id && r.to === this)
      .map((r) => r.from);
  }

  get relatedNodes(): GraphNode[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  private assertValidRelation(relation: GraphRelation) {
    if (relation.from.id !== this.id && relation.to.id !== this.id) {
      throw new Error(`Relation ${relation} does not involve node ${this}`);
    }
  }
}
