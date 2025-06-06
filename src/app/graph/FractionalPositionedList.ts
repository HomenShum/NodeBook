import { generateNKeysBetween } from "fractional-indexing";
import { action, computed, isObservable, makeObservable, observable } from "mobx";

import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { PartialUpdateRelationList } from "@/app/graph/GraphUpdate";
import { Serializable } from "@/app/persistence/serialization";
import { SerializedPositionList } from "@/app/persistence/SerializedData";
import { Position, comparePositions, generateDefaultPosition } from "@/app/util";
import logger from "@/lib/logger";

export type ItemWithPosition<T> = {
  item: T;
  position: Position;
};

type ListItem = {
  id: string;
  createdAt: Date;
  isPublic: boolean;
};

export class FractionalPositionedList<T extends ListItem & Serializable> implements Serializable {
  private map = new Map<string, ItemWithPosition<T>>();

  constructor(items: T[] = []) {
    items.forEach((item) => {
      this.map.set(item.id, {
        position: generateDefaultPosition(item.createdAt),
        item,
      });
    });
    this.makeObservable();
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeObservable<FractionalPositionedList<T>, "map">(this, {
      map: observable.shallow,
      keys: computed,
      add: action,
      delete: action,
      move: action,
      clear: action,
      load: action,
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

  add(item: T | T[], after?: Positioner<T>): PartialUpdateRelationList[] {
    const partialUpdates: PartialUpdateRelationList[] = [];
    const oldPosition = null;
    const operation = "updateRelationList";

    const items = Array.isArray(item) ? item : [item];
    let int: number, fracs: string[];
    if (this.map.size === 0 || !after) {
      int = Date.now();
      fracs = generateNKeysBetween(null, null, items.length);
      items.forEach((item, i) => {
        // TODO: should this throw?
        if (this.map.has(item.id)) return logger.error("Attempted to add item that is already in the list");
        const newPosition = { int, frac: fracs[i] };
        this.map.set(item.id, { position: newPosition, item });
        partialUpdates.push({
          operation,
          relationId: item.id,
          oldPosition,
          newPosition,
        });
      });
    } else {
      const { addedPositions, updatedPositions } = this.generatePositionsForInsert(after, items.length);
      addedPositions.forEach((position, i) => {
        this.map.set(items[i].id, { position, item: items[i] });
        partialUpdates.push({
          operation,
          relationId: items[i].id,
          oldPosition,
          newPosition: position,
        });
      });
      updatedPositions.forEach((position, id) => {
        const existing = this.map.get(id);
        if (!existing) return logger.error("Attempted to reposition item that is not in the list");
        this.map.set(id, { ...existing, position });
        partialUpdates.push({
          operation,
          relationId: id,
          oldPosition,
          newPosition: position,
        });
      });
    }

    return partialUpdates;
  }

  delete(id: string): PartialUpdateRelationList[] {
    const { item, position } = this.map.get(id) ?? {};
    if (!item || !position) return [];
    this.map.delete(id);
    return [
      {
        operation: "updateRelationList",
        relationId: id,
        oldPosition: position,
        newPosition: null,
      },
    ];
  }

  // TODO: check if this should return updates
  undoDelete(itemWithPosition: ItemWithPosition<T> | undefined) {
    if (!itemWithPosition) return;
    this.map.set(itemWithPosition.item.id, itemWithPosition);
  }

  move(items: T[], after?: Positioner<T>): PartialUpdateRelationList[] {
    const partialUpdates: PartialUpdateRelationList[] = [];
    const operation = "updateRelationList";

    let int: number, fracs: string[];
    if (!after) {
      int = Date.now();
      fracs = generateNKeysBetween(null, null, items.length);
      items.forEach((item, i) => {
        const { position } = this.map.get(item.id) ?? {};
        if (!position) return logger.error("Attempted to move item that is not in the list");
        const newPosition = { int, frac: fracs[i] };
        this.map.set(item.id, { position: newPosition, item });
        partialUpdates.push({
          operation,
          relationId: item.id,
          oldPosition: position,
          newPosition,
        });
      });
    } else {
      const { addedPositions, updatedPositions } = this.generatePositionsForInsert(after, items.length);
      addedPositions.forEach((position, i) => {
        this.map.set(items[i].id, { position, item: items[i] });
        partialUpdates.push({
          operation,
          relationId: items[i].id,
          oldPosition: null, // TODO: not sure if there is no old position
          newPosition: position,
        });
      });
      updatedPositions.forEach((position, id) => {
        const existing = this.map.get(id);
        if (!existing) return logger.error("Attempted to reposition item that is not in the list");
        const oldPosition = existing.position;
        this.map.set(id, { ...existing, position });
        partialUpdates.push({
          operation,
          relationId: id,
          oldPosition: oldPosition,
          newPosition: position,
        });
      });
    }

    return partialUpdates;
  }

  private generatePositionsForInsert(positioner: Positioner<T>, n: number) {
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
    return generatePositionsForInsert(
      items.map((v) => ({ position: v.position, id: v.item.id })),
      i,
      n,
    );
  }

  serialize(): SerializedPositionList<T> {
    const result: { [key: string]: Position } = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = value.position;
    }
    return result;
  }

  /**
   * Loads positioned items into the list without clearing existing items.
   * If an item already exists in the list, it will be replaced.
   * @see file://./design-notes.md#load-methods
   */
  load(items: ItemWithPosition<T>[]) {
    items.forEach((item) => {
      this.map.set(item.item.id, item);
    });
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

/**
 * Generate new positions for inserting items into a sorted list of items with positions.
 * If needed to maintain ordering, provides updated positions for existing items.
 *
 * @param items - Sorted list of items with positions
 * @param i - Index after which to insert new positions
 * @param n - Number of new positions to insert
 * @returns Object containing new positions and updated positions for existing items
 * @throws Error if index is out of bounds or n is not positive
 */
export function generatePositionsForInsert(items: { position: Position; id: string }[], i: number, n: number) {
  if (n < 0) {
    throw new Error("Number of positions to insert must be positive");
  }

  const addedPositions: Position[] = [];
  const updatedPositions = new Map<string, Position>();

  // Handle empty list case
  if (items.length === 0) {
    const int = Math.floor(Date.now() / 1000); // Use seconds instead of milliseconds
    generateNKeysBetween(null, null, n).forEach((frac) => addedPositions.push({ int, frac }));
    return { addedPositions, updatedPositions };
  }

  // Check for index out of bounds
  if (i < 0 || i >= items.length) {
    throw new Error("Index out of bounds");
  }

  const currentPosition = items[i].position;
  let nextDifferentIndex: number = i + 1;

  // Find the next different position
  while (
    nextDifferentIndex < items.length &&
    items[nextDifferentIndex].position.int === currentPosition.int &&
    items[nextDifferentIndex].position.frac === currentPosition.frac
  ) {
    nextDifferentIndex++;
  }

  // Generate new fractional keys
  const nextDifferentPosition = items[nextDifferentIndex]?.position ?? null;
  const newFracs = generateNKeysBetween(
    currentPosition.frac,
    // it's only if the current and next share an int part that we need to generate between them
    nextDifferentPosition?.int === currentPosition.int ? nextDifferentPosition?.frac : null,
    // new positions + positions to update
    n + (nextDifferentIndex - i - 1),
  );

  // Create new positions and update existing ones if necessary
  newFracs.slice(0, n).forEach((frac) => addedPositions.push({ int: currentPosition.int, frac }));
  newFracs.slice(n).forEach((frac, index) => {
    const itemToUpdate = items[i + 1 + index];
    updatedPositions.set(itemToUpdate.id, { int: currentPosition.int, frac });
  });

  return { addedPositions, updatedPositions };
}
