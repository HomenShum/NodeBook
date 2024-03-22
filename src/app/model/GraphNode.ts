import { generateNKeysBetween } from "fractional-indexing";
import { makeAutoObservable } from "mobx";
import { compareFractionIndices, uuid } from "../util";
import { GraphRelation, GraphRelationType } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { RemoteGraphStore } from "./RemoteGraphStore";

export type GraphNodeProps = {
  id?: string;
  text?: string;
  thoughtstreamPosition?: string;
};

export type RelativePositionProps = {
  target?: GraphRelation;
  side?: "above" | "below";
};

type PositionedRelation = {
  position: string;
  relation: GraphRelation;
};

export class GraphNode {
  public id: string;
  public text: string = "";
  public allRelationsById = new Map<string, PositionedRelation>();
  public pinnedRelationsById = new Map<string, PositionedRelation>();
  public thoughtstreamPosition?: string;

  constructor(
    private store: GraphStore,
    private remote?: RemoteGraphStore,
    { id, thoughtstreamPosition, text = "" }: GraphNodeProps = {},
  ) {
    this.id = id || uuid();
    this.thoughtstreamPosition = thoughtstreamPosition;
    this.text = text;
    makeAutoObservable(this);
  }

  get relations(): GraphRelation[] {
    return Array.from(this.allRelationsById.values()).map((r) => r.relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return Array.from(this.allRelationsById.values())
      .sort((a, b) => compareFractionIndices(a.position, b.position))
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
    if (this.remote) {
      this.remote.upsertNode(this.id, text, this.thoughtstreamPosition ?? null);
    }
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
    let positionBefore: string | null = null;
    let positionAfter: string | null = null;
    if (target) {
      // insert relations beside target
      const positionedRelations = Array.from(this.allRelationsById.values()).sort((a, b) =>
        compareFractionIndices(a.position, b.position),
      );
      const index = positionedRelations.findIndex((r) => r.relation.id === target.id);
      positionBefore = positionedRelations[index]?.position ?? null;
      positionAfter = positionedRelations[index + 1]?.position ?? null;
    } else if (side === "above") {
      // insert relations above all other relations
      positionBefore = null;
      positionAfter = this.getFirstPosition();
    } else if (side === "below") {
      // insert relations below all other relations
      positionBefore = this.getLastPosition();
      positionAfter = null;
    }
    const newPositions = generateNKeysBetween(positionBefore, positionAfter, relations.length);
    relations.forEach((relation, i) => {
      this.allRelationsById.set(relation.id, { position: newPositions[i], relation });
    });
  }

  removeRelation(relation: GraphRelation) {
    this.allRelationsById.delete(relation.id);
    this.pinnedRelationsById.delete(relation.id);
  }

  pinRelation({ target, side = "below" }: RelativePositionProps, ...relations: GraphRelation[]) {
    relations.forEach((r) => {
      if (!this.allRelationsById.has(r.id)) {
        throw new Error(`Cannot pin relation that is not attached to node`);
      }
    });
    let positionBefore: string | null = null;
    let positionAfter: string | null = null;
    if (target) {
      const positionedRelations = Array.from(this.pinnedRelationsById.values()).sort((a, b) =>
        compareFractionIndices(a.position, b.position),
      );
      const index = positionedRelations.findIndex((r) => r.relation.id === target.id);
      positionBefore = positionedRelations[index]?.position ?? null;
      positionAfter = positionedRelations[index + 1]?.position ?? null;
    } else if (side === "above") {
      positionBefore = null;
      positionBefore = this.getFirstPinnedPosition();
    } else if (side === "below") {
      positionAfter = null;
      positionAfter = this.getLastPinnedPosition();
    }
    const newPositions = generateNKeysBetween(positionBefore, positionAfter, relations.length);
    relations.forEach((relation, i) => {
      this.pinnedRelationsById.set(relation.id, { position: newPositions[i], relation });
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

  getLastPosition() {
    return (
      Array.from(this.allRelationsById.values())
        .sort((a, b) => compareFractionIndices(a.position, b.position))
        .map((r) => r.position)
        .splice(-1)[0] ?? null
    );
  }

  getFirstPosition() {
    return (
      Array.from(this.allRelationsById.values())
        .sort((a, b) => compareFractionIndices(a.position, b.position))
        .map((r) => r.position)[0] ?? null
    );
  }

  getLastPinnedPosition() {
    return (
      Array.from(this.pinnedRelationsById.values())
        .sort((a, b) => compareFractionIndices(a.position, b.position))
        .map((r) => r.position)
        .splice(-1)[0] ?? null
    );
  }

  getFirstPinnedPosition() {
    return (
      Array.from(this.pinnedRelationsById.values())
        .sort((a, b) => compareFractionIndices(a.position, b.position))
        .map((r) => r.position)[0] ?? null
    );
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
