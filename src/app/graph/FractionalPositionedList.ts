import { generateNKeysBetween } from "fractional-indexing";
import { action, computed, makeObservable, observable } from "mobx";

import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { SerializedPositionList } from "@/app/persistence/SerializedData";
import { Serializable } from "@/app/persistence/serialization";
import { Position, comparePositions, generateDefaultPosition } from "@/app/util";
import logger from "@/lib/logger";

export type ItemWithPosition<T> = {
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

  /**
   * Add one or more items to the list. The `after` parameter can specify an
   * existing item in the list to insert the new items after. If not provided,
   * the items will be added to the top of the list.
   */
  add(item: T | T[], after?: Positioner<T>) {
    const items = Array.isArray(item) ? item : [item];
    let int: number, fracs: string[];
    if (this.map.size === 0 || !after) {
      int = Math.max(...Array.from(items).map((item) => item.createdAt.getTime()));
      fracs = generateNKeysBetween(null, null, items.length);
    } else {
      const position = this.positionerToPosition(after);
      int = position.int;
      fracs = generateNKeysBetween(position.fracBefore, position.fracAfter, items.length);
    }
    items.forEach((item, i) => {
      // don't re-insert items; that would reset their position (ENT-3361)
      if (this.map.has(item.id)) return;
      this.map.set(item.id, { position: { int, frac: fracs[i] }, item });
    });
  }

  delete(id: string) {
    return this.map.delete(id);
  }

  undoDelete(itemWithPosition: ItemWithPosition<T> | undefined) {
    if (!itemWithPosition) return;
    this.map.set(itemWithPosition.item.id, itemWithPosition);
  }

  /**
   * Move items to a new position in the list.
   *
   * The `to` parameter can specify an item to position the items after, or
   * "top" or "bottom" to move to the top or bottom of the list.
   */
  move(items: T[], after?: Positioner<T>) {
    let int: number, fracs: string[];
    if (!after) {
      int = Date.now();
      fracs = generateNKeysBetween(null, null, items.length);
    } else {
      const positions = this.positionerToPosition(after);
      int = positions.int;
      fracs = generateNKeysBetween(positions.fracBefore, positions.fracAfter, items.length);
    }
    items.forEach((item, i) => {
      if (!this.map.has(item.id)) {
        logger.error("Attempted to move item that is not in the list");
        return;
      }
      this.map.set(item.id, { position: { int, frac: fracs[i] }, item });
    });
  }

  private positionerToPosition(positioner: Positioner<T>): {
    int: number;
    fracBefore: string | null;
    fracAfter: string | null;
  } {
    const items = Array.from(this.map.values()).sort((a, b) => comparePositions(a.position, b.position));
    let i: number;
    if (typeof positioner === "number") {
      i = positioner > 0 ? Math.min(positioner, items.length - 1) : Math.max(0, items.length + positioner);
    } else {
      const predicate =
        typeof positioner === "string"
          ? (v: ItemWithPosition<T>) => v.item.id === positioner
          : (v: ItemWithPosition<T>) => v.item.id === positioner.id;
      i = items.findIndex(predicate);
    }
    const int = items[i]?.position.int ?? 0;
    const fracBefore = items[i]?.position.frac;
    let fracAfter = items[i]?.position.int === items[i + 1]?.position.int ? items[i + 1]?.position.frac : null;
    if (fracBefore && fracAfter && fracBefore === fracAfter) {
      logger.error("Attempted to insert item between two items with the same position");
      fracAfter = null;
    }
    return { int, fracBefore, fracAfter };
  }

  serialize(): SerializedPositionList<T> {
    const result: { [key: string]: Position } = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = value.position;
    }
    return result;
  }

  static deserialize<T extends ListItem & Serializable>(
    positionsByItemId: SerializedPositionList<T>,
    getItem: (id: string) => T | null,
  ): FractionalPositionedList<T> {
    const list = new FractionalPositionedList<T>();
    const result = new Map();
    for (const [itemId, position] of Object.entries(positionsByItemId)) {
      const item = getItem(itemId);
      if (item === null) {
        logger.warn(`Item with ID ${itemId} not found in deserialization`);
        continue;
      }
      result.set(itemId, {
        item,
        position,
      });
    }
    list.map = result;
    return list;
  }
}
