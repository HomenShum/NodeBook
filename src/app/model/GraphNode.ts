import { makeAutoObservable } from "mobx";
import { Position, comparePositions } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { GraphRelation } from "./GraphRelation";
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
  public allRelationsList = new FractionalPositionedList<GraphRelation>([]);
  public pinnedRelationsList = new FractionalPositionedList<GraphRelation>([]);
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
    return this.allRelationsList.values().map(({ item }) => item);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return Array.from(this.allRelationsList.values())
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ item }) => item);
  }

  get relationsWithPositions(): PositionedRelation[] {
    return this.allRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
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
