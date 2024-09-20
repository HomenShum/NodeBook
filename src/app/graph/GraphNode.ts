import { action, computed, isObservable, makeObservable, observable, reaction, toJS } from "mobx";

import { SerializedNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { ObjectPath, Position, uuid } from "@/app/util";
import { DELETED_NODE_TEXT } from "@/app/graph/constants";

import { BaseGraphObject, GraphObject } from "./GraphObject";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";

export type Chip = {
  type: "text" | "mention" | "linebreak";
  value: string;
};

export type GraphNodeProps = {
  version?: number;
  id?: string;
  authorId?: string;
  content?: Chip[] | string;
  createdAt?: Date;
  isBundle?: boolean;
  isZone?: boolean;
  isPublic?: boolean;
};

export type PositionedRelation = {
  position: Position;
  relation: GraphRelation;
};

export class GraphNode extends BaseGraphObject implements Serializable {
  readonly objectType = "node";
  version: number;
  id: string;
  authorId: string;
  content: Chip[] = [];
  createdAt: Date;
  isBundle: boolean;
  isZone: boolean;
  isPublic: boolean = true;

  constructor(
    store: GraphStore,
    {
      authorId,
      version = 1,
      id = uuid(),
      content = [],
      createdAt = new Date(),
      isBundle = false,
      isZone = false,
      isPublic = false,
    }: GraphNodeProps & { authorId: string },
  ) {
    super(store);

    this.version = version;
    this.id = id;
    this.authorId = authorId;
    this.content =
      Array.isArray(content) && content.length > 0
        ? content
        : [{ type: "text", value: typeof content === "string" ? content : "" }];
    this.createdAt = createdAt;
    this.isBundle = isBundle;
    this.isZone = isZone;
    this.isPublic = isPublic;
    this.makeObservable();

    //Whenever a mentioned node is deleted, the text changes.
    //If the updated text contains a "deleted node", iterate over
    //the chips and remove the mention chip.
    reaction(
      () => this.text,
      (text) => {
        if (!text.includes(DELETED_NODE_TEXT)) return;
        const content: Chip[] = [];
        let updateChips = false;
        for (const chip of this.content) {
          if (chip.type === "mention") {
            if (!store.hasNode(chip.value)) {
              updateChips = true;
              continue;
            }
          }
          content.push(chip);
        }
        if (updateChips) {
          store.updateNode({ nodeId: this.id, nodeProps: { content } });
        }
      },
    );
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      version: observable,
      createdAt: observable,
      isBundle: observable,
      isZone: observable,
      isPublic: observable,
      content: observable.shallow,
      update: action,
      text: computed,
      isLocal: computed,
      relationsWithPositions: computed,
    });
  }

  update(newProps: Partial<GraphNodeProps>) {
    const oldValues: Partial<GraphNodeProps> = {};
    if (newProps.content !== undefined) {
      oldValues.content = this.content;
      this.content =
        typeof newProps.content === "string" ? [{ type: "text", value: newProps.content }] : newProps.content;
    }
    if (newProps.isBundle !== undefined) {
      oldValues.isBundle = this.isBundle;
      this.isBundle = newProps.isBundle;
    }
    if (newProps.isZone !== undefined) {
      oldValues.isZone = this.isZone;
      this.isZone = newProps.isZone;
    }
    if (newProps.isPublic !== undefined) {
      oldValues.isPublic = this.isPublic;
      this.isPublic = newProps.isPublic;
    }
    oldValues.version = this.version;
    if (newProps.version !== undefined) {
      this.version = newProps.version;
    } else {
      this.version++;
    }

    return oldValues;
  }

  // Todo: Since text is a getter property, we cannot pass
  // parameters to it. For now text property acts as a proxy
  // to _dfsText. Need to come up with a cleaner solution
  // without breaking things.
  _dfsText(visitedMap: Record<string, boolean> = {}): string {
    visitedMap[this.id] = true;
    return this.content
      .map((chip) => {
        switch (chip.type) {
          case "text":
          case "linebreak":
            return chip.value;
          case "mention":
            const referencedNode = this.store.getNode(chip.value);
            if (!referencedNode) return `@[${DELETED_NODE_TEXT}]`;
            try {
              return visitedMap[referencedNode.id] ? "" : `@[${referencedNode._dfsText(visitedMap)}]`;
            } catch (error) {
              console.error("Error accessing referencedNode.text:", error);
              return "@[Error]";
            }
        }
      })
      .join("");
  }

  get text(): string {
    return this._dfsText();
  }

  get searchText(): string {
    return this.text;
  }

  toString() {
    return `Node(${this.id.slice(0, 8)}: ${this.text.slice(0, 8)})`;
  }

  /**
   * This uses somewhat arbitrary heuristics to try to find a path to the global root.
   * In the future, we'll probably introduce canonical paths which reliably
   * lead to the root. See https://linear.app/ideaflow/issue/ENT-3930/canonical-paths
   */
  getPath({ limit = 10 }: { limit?: number } = {}): ObjectPath {
    const relations: GraphRelation[] = [];
    let current: GraphObject | undefined = this;

    for (let i = 0; i < limit && current && current !== this.store.globalRoot; i++) {
      const nextRelations: GraphRelation[] = current.relations
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .filter((r) => r.to.id === current?.id);
      const nextRelation =
        nextRelations.find((r) => r.relationType.id === "child" || r.relationType.id === "sublist") || nextRelations[0];
      if (!nextRelation || relations.some((p) => p.id === nextRelation.id)) {
        return { relations, object: this };
      }
      relations.unshift(nextRelation);
      current = nextRelation.from;
    }
    return { relations, object: this };
  }

  serialize(): SerializedNode {
    return {
      version: this.version,
      id: this.id,
      authorId: this.authorId,
      createdAt: this.createdAt,
      content: toJS(this.content),
      isBundle: this.isBundle,
      isZone: this.isZone,
      isPublic: this.isPublic,
    };
  }
}
