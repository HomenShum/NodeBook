import { generateNKeysBetween } from "fractional-indexing";
import { action, computed, makeObservable, observable } from "mobx";
import { Position, comparePositions, generateDefaultPosition } from "../util";
import { Serializable } from "./serialization";

type ItemWithPosition<T> = {
  item: T;
  position: Position;
};

type ListItem = {
  id: string;
  createdAt: Date;
};

export class FractionalPositionedList<T extends ListItem & Serializable> implements Serializable {
  map = new Map<string, ItemWithPosition<T>>();
  constructor(items: T[] = []) {
    items.forEach((item) => {
      this.map.set(item.id, {
        position: generateDefaultPosition(item.createdAt),
        item,
      });
    });
    makeObservable<FractionalPositionedList<T>, "map">(this, {
      map: observable,
      keys: computed,
      add: action,
      delete: action,
      move: action,
    });
  }

  get(id: string) {
    return this.map.get(id);
  }

  has(id: string) {
    return this.map.has(id);
  }

  values(): ItemWithPosition<T>[] {
    return Array.from(this.map.values());
  }

  get keys() {
    return Array.from(this.map.keys());
  }

  /** Add items to the top of the list */
  add(...items: T[]) {
    if (this.map.size === 0) {
      const int = Math.max(...Array.from(items).map((item) => item.createdAt.getTime()));
      const fracs = generateNKeysBetween(null, null, items.length);
      items.forEach((item, i) => {
        this.map.set(item.id, { position: { int, frac: fracs[i] }, item });
      });
    } else {
      const positionedRelations = Array.from(this.map.values()).sort((a, b) =>
        comparePositions(a.position, b.position),
      );
      const topPosition = positionedRelations[0].position;
      const int = Math.max(topPosition.int, ...items.map((item) => item.createdAt.getTime()));
      const fracs = generateNKeysBetween(null, topPosition.int === int ? topPosition.frac : null, items.length);
      items.forEach((item, i) => {
        // don't re-insert items; that would reset their position (ENT-3361)
        if (this.map.has(item.id)) return;
        this.map.set(item.id, { position: { int, frac: fracs[i] }, item });
      });
    }
  }

  delete(id: string) {
    return this.map.delete(id);
  }

  /**
   * Move items to a new position in the list.
   *
   * The `to` parameter can specify an item to position the items after, or
   * "top" or "bottom" to move to the top or bottom of the list.
   */
  move(items: T[], to: T | "top" | "bottom" | ((v: ItemWithPosition<T>) => boolean)) {
    let posInt: number;
    let posFracBefore: string | null = null;
    let posFracAfter: string | null = null;
    const positionedRelations = Array.from(this.map.values()).sort((a, b) => comparePositions(a.position, b.position));
    if (to === "top") {
      posInt = positionedRelations[0]?.position.int ?? items[0].createdAt.getTime();
      posFracBefore = null;
      posFracAfter = positionedRelations[0]?.position.frac ?? null;
    } else if (to === "bottom") {
      posInt = positionedRelations[positionedRelations.length - 1]?.position.int ?? items[0].createdAt.getTime();
      posFracBefore = positionedRelations[positionedRelations.length - 1]?.position.frac ?? null;
      posFracAfter = null;
    } else {
      // Move item after the specified item
      const predicate = typeof to === "function" ? to : (v: ItemWithPosition<T>) => v.item.id === to.id;
      const index = positionedRelations.findIndex(predicate);
      const itemBefore = positionedRelations[index];
      const itemAfter = positionedRelations[index + 1];
      posInt = itemBefore?.position.int ?? items[0].createdAt.getTime();
      posFracBefore = itemBefore?.position.frac ?? null;
      // It's only when the items have the same int position part that we need to consider the fractional part
      posFracAfter = itemBefore?.position.int === itemAfter?.position.int ? itemAfter?.position.frac ?? null : null;
    }
    const newFractionalPositions = generateNKeysBetween(posFracBefore, posFracAfter, items.length);
    items.forEach((item, i) => {
      this.map.set(item.id, { position: { int: posInt, frac: newFractionalPositions[i] }, item });
    });
  }

  serialize() {
    const result: { [key: string]: { item: ReturnType<T["serialize"]>; position: Position } } = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = {
        item: value.item.serialize(),
        position: value.position,
      };
    }
    return result;
  }

  static deserialize<T extends ListItem & Serializable>(
    data: ReturnType<FractionalPositionedList<T>["serialize"]>,
    deserializeInnerType: (data: any) => T | null,
  ): FractionalPositionedList<T> {
    const list = new FractionalPositionedList<T>();
    const result = new Map();
    for (const [key, value] of Object.entries(data)) {
      const item = deserializeInnerType(value.item);
      if (item === null) {
        continue;
      }
      result.set(key, {
        item: deserializeInnerType(value.item),
        position: value.position,
      });
    }

    list.map = result;
    return list;
  }
}
