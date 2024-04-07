import { makeAutoObservable } from "mobx";
import { Position, comparePositions } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { GraphRelation, GraphRelationType } from "./GraphRelation";
import { GraphStore } from "./GraphStore";
import { RemoteGraphStore } from "./RemoteGraphStore";

export type Chip = {
  type: "text" | "mention";
  value: string;
};

export type GraphNodeProps = {
  id?: string;
  content?: Chip[];
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
  public content: Chip[] = [];
  public allRelationsById = new FractionalPositionedList<GraphRelation>([]);
  public pinnedRelationsById = new FractionalPositionedList<GraphRelation>([]);
  // public allRelationsById = new Map<string, PositionedRelation>();
  // public pinnedRelationsById = new Map<string, PositionedRelation>();
  public createdAt = new Date();

  constructor(
    private store: GraphStore,
    private remote: RemoteGraphStore | null,
    { id, content = [] }: { id: string; content?: Chip[] },
  ) {
    this.id = id;
    this.content = content;
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
    return this.allRelationsById.values().map(({ item }) => item);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return Array.from(this.allRelationsById.values())
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ item }) => item);
  }

  get relationsWithPositions(): PositionedRelation[] {
    return this.allRelationsById.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsById.values().map(({ position, item }) => ({ position, relation: item }));
  }

  setContent(newContent: Chip[]) {
    this.content = newContent;
  }

  get text(): string {
    return this.content
      .map((chip) => {
        return chip.type == "mention" ? this.store.getNode(chip.value)?.text || "[Deleted node]" : chip.value;
      })
      .join();
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
    this.allRelationsById.add(...relations);
    if (target) {
      // TODO we're not considering side here
      this.allRelationsById.moveAfter(relations, target);
    }
    // let posBefore: Position | null = null;
    // let posAfter: Position | null = null;
    // const positionedRelations = Array.from(this.allRelationsById.values()).sort((a, b) =>
    //   comparePositions(a.position, b.position),
    // );
    // if (target) {
    //   // insert relations beside target
    //   const index = positionedRelations.findIndex((r) => r.relation.id === target.id);
    //   posBefore = positionedRelations[index]?.position ?? null;
    //   posAfter = positionedRelations[index + 1]?.position ?? null;
    // } else if (side === "above") {
    //   // insert relations above all other relations
    //   posBefore = null;
    //   posAfter = positionedRelations[0]?.position ?? null;
    // } else if (side === "below") {
    //   // insert relations below all other relations
    //   posBefore = positionedRelations[positionedRelations.length - 1]?.position ?? null;
    //   posAfter = null;
    // }
    // const newFractionalPositions = generateNKeysBetween(
    //   posBefore?.frac ?? null,
    //   posAfter?.frac ?? null,
    //   relations.length,
    // );
    // relations.forEach((relation, i) => {
    //   this.allRelationsById.set(relation.id, {
    //     position: { int: posBefore?.int ?? relation.createdAt.getTime(), frac: newFractionalPositions[i] },
    //     relation,
    //   });
    // });
  }

  moveRelationsAfterSibling(relations: GraphRelation[], sibling: GraphRelation) {
    this.allRelationsById.moveAfter(relations, sibling);
    // relations.forEach((r) => this.assertValidRelation(r)); // TODO can you have multiple relations with the same id?
    // if (sibling) this.assertValidRelation(sibling);
    // let posBefore: Position | null = null;
    // let posAfter: Position | null = null;
    // const positionedRelations = Array.from(this.allRelationsById.values()).sort((a, b) =>
    //   comparePositions(a.position, b.position),
    // );
    // if (sibling) {
    //   // insert relations after sibling
    //   const index = positionedRelations.findIndex((r) => r.relation.id === sibling.id);
    //   posBefore = positionedRelations[index]?.position ?? null;
    //   posAfter = positionedRelations[index + 1]?.position ?? null;
    // } else {
    //   // insert relations above all other relations
    //   posBefore = null;
    //   posAfter = positionedRelations[0]?.position ?? null;
    // }
    // const newFractionalPositions = generateNKeysBetween(
    //   posBefore?.frac ?? null,
    //   posAfter?.frac ?? null,
    //   relations.length,
    // );
    // relations.forEach((relation, i) => {
    //   this.allRelationsById.set(relation.id, {
    //     position: { int: posBefore?.int ?? relation.createdAt.getTime(), frac: newFractionalPositions[i] },
    //     relation,
    //   });
    // });
  }

  pinRelation({ target, side = "below" }: RelativePositionProps, ...insertingRelations: GraphRelation[]) {
    throw new Error("Method not implemented.");
    // insertingRelations.forEach((r) => this.assertValidRelation(r));
    // let posBefore: Position | null = null;
    // let posAfter: Position | null = null;
    // const pinnedRelations = Array.from(this.pinnedRelationsById.values()).sort((a, b) =>
    //   comparePositions(a.position, b.position),
    // );
    // if (target) {
    //   const index = pinnedRelations.findIndex((r) => r.relation.id === target.id);
    //   posBefore = pinnedRelations[index]?.position ?? null;
    //   posAfter = pinnedRelations[index + 1]?.position ?? null;
    // } else if (side === "above") {
    //   posBefore = null;
    //   posAfter = pinnedRelations[0]?.position ?? null;
    // } else if (side === "below") {
    //   posBefore = pinnedRelations[pinnedRelations.length - 1]?.position ?? null;
    //   posAfter = null;
    // }
    // const newFractionalPositions = generateNKeysBetween(
    //   posBefore?.frac ?? null,
    //   posAfter?.frac ?? null,
    //   insertingRelations.length,
    // );
    // insertingRelations.forEach((relation, i) => {
    //   this.pinnedRelationsById.set(relation.id, {
    //     position: { int: posBefore?.int ?? relation.createdAt.getTime(), frac: newFractionalPositions[i] },
    //     relation,
    //   });
    // });
  }

  unpinRelation(...relations: GraphRelation[]) {
    throw new Error("Method not implemented.");
    // relations.forEach((r) => this.pinnedRelationsById.delete(r.id));
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
