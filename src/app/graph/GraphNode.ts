import { action, computed, isObservable, makeObservable, observable, toJS } from "mobx";

import { DELETED_NODE_TEXT } from "@/app/graph/constants";
import { getOtherObject } from "@/app/graph/utils";
import { SerializedNode } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { comparePositions, ObjectPath, Position, uuid } from "@/app/util";
import logger from "@/lib/logger";

import { BaseGraphObject, GraphObject } from "./GraphObject";
import { GraphRelation } from "./GraphRelation";
import { GraphStore } from "./GraphStore";

export type Chip =
  | {
      type: "text" | "mention" | "linebreak";
      value: string;
    }
  | {
      type: "link";
      value: string;
      url: string;
    };

export type GraphNodeProps = {
  version?: number;
  id?: string;
  authorId?: string;
  content?: Chip[] | string;
  createdAt?: Date;
  updatedAt?: Date;
  isPublic?: boolean;
  isNewRelatedObjectsPublic?: boolean;
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
  updatedAt: Date;
  isPublic: boolean = true;
  isNewRelatedObjectsPublic: boolean;

  constructor(
    store: GraphStore,
    {
      authorId,
      version = 1,
      id = uuid(),
      content = [],
      createdAt = new Date(),
      updatedAt = new Date(createdAt.getTime()),
      isPublic = false,
      isNewRelatedObjectsPublic = false,
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
    this.updatedAt = updatedAt;
    this.isPublic = isPublic;
    this.isNewRelatedObjectsPublic = isNewRelatedObjectsPublic;
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable(this, {
      version: observable,
      createdAt: observable,
      updatedAt: observable,
      isPublic: observable,
      isNewRelatedObjectsPublic: observable,
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
    if (newProps.isPublic !== undefined) {
      oldValues.isPublic = this.isPublic;
      this.isPublic = newProps.isPublic;
    }
    if (newProps.isNewRelatedObjectsPublic !== undefined) {
      oldValues.isNewRelatedObjectsPublic = this.isNewRelatedObjectsPublic;
      this.isNewRelatedObjectsPublic = newProps.isNewRelatedObjectsPublic;
    }
    oldValues.version = this.version;
    if (newProps.version !== undefined) {
      this.version = newProps.version;
    } else {
      this.version++;
    }
    oldValues.updatedAt = this.updatedAt;
    if (newProps.updatedAt !== undefined) {
      this.updatedAt = newProps.updatedAt;
    } else {
      this.updatedAt = new Date();
    }

    return oldValues;
  }

  /**
   * Recursively traverses the node and its descendants to build a string
   * representation of the node's content.
   *
   * If `markupMentions` is true, mentions are wrapped in `@[...]`
   *
   * Todo: Since text is a getter property, we cannot pass
   * parameters to it. For now text property acts as a proxy
   * to _dfsText. Need to come up with a cleaner solution
   * without breaking things.
   */
  _dfsText(visitedMap: Record<string, boolean> = {}, markupMentions = true): string {
    visitedMap[this.id] = true;
    return this.content
      .map((chip) => {
        switch (chip.type) {
          case "text":
          case "linebreak":
          case "link":
            return chip.value;
          case "mention":
            const referencedNode = this.store.getNode(chip.value);
            if (!referencedNode) return markupMentions ? `@[${DELETED_NODE_TEXT}]` : DELETED_NODE_TEXT;
            try {
              if (visitedMap[referencedNode.id]) {
                return "";
              } else {
                const text = referencedNode._dfsText(visitedMap, markupMentions);
                return markupMentions ? `@[${text}]` : text;
              }
            } catch (error) {
              console.error("Error accessing referencedNode.text:", error);
              return "@[Error]";
            }
          default:
            chip satisfies never;
        }
      })
      .join("");
  }

  get text(): string {
    const text = this._dfsText({}, true);
    if (this.noteContentRelationsList.size > 0) {
      return [
        text ? text + " - " : "",
        ...this.noteContentRelationsList
          .values()
          .sort((a, b) => comparePositions(a.position, b.position))
          .map(({ item }) => getOtherObject(item, this.id)?.text ?? ""),
      ].join(" ");
    } else {
      return text;
    }
  }

  get searchText(): string {
    if (this.noteContentRelationsList.size > 0) {
      return [
        this._dfsText({}, false),
        ...this.noteContentRelationsList
          .values()
          .sort((a, b) => comparePositions(a.position, b.position))
          .map(({ item }) => getOtherObject(item, this.id)?.searchText ?? ""),
      ].join(" ");
    } else {
      return this._dfsText({}, false);
    }
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
      const nextRelationOptions: GraphRelation[] = current.relations
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .filter((r) => r.to.id === current?.id);
      let nextRelation: GraphRelation | null = null;
      // If we're at the user root, default to the usersToUserRelation
      if (current.id === this.store.userRoot.id) {
        try {
          if (
            (this.store.usersToUserRelation && this.store.usersToUserRelation.to.id === this.store.userRoot.id) ||
            this.store.usersToUserRelation.from.id === this.store.globalRoot.id
          ) {
            nextRelation = this.store.usersToUserRelation;
          } else {
            logger.error("Valid usersToUserRelation not found", {
              current: current.id,
              usersToUserRelationFromId: this.store.usersToUserRelation.from.id,
              usersToUserRelationToId: this.store.usersToUserRelation.to.id,
            });
          }
        } catch (error) {
          logger.error("Error accessing usersToUserRelation:", error);
        }
      }
      if (!nextRelation) {
        nextRelation =
          nextRelationOptions.find((r) => r.relationType.id === "child" || r.relationType.id === "sublist") ||
          nextRelationOptions[0];
      }
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
      updatedAt: this.updatedAt,
      content: toJS(this.content),
      isPublic: this.isPublic,
      isNewRelatedObjectsPublic: this.isNewRelatedObjectsPublic,
    };
  }
}
