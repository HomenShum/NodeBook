import { generateNKeysBetween } from "fractional-indexing";
import { action, makeObservable, observable } from "mobx";
import { Position, comparePositions, generateDefaultPosition } from "../util";

type ItemWithPosition<T> = {
  item: T;
  position: Position;
};

export class FractionalPositionedList<T extends { id: string; createdAt: Date }> {
  private map = new Map<string, ItemWithPosition<T>>();
  constructor(items: T[]) {
    items.forEach((item) => {
      this.map.set(item.id, {
        position: generateDefaultPosition(item.createdAt),
        item,
      });
    });
    makeObservable<FractionalPositionedList<T>, "map">(this, {
      map: observable,
      add: action,
      delete: action,
      move: action,
    });
  }

  get(id: string) {
    return this.map.get(id);
  }

  values(): ItemWithPosition<T>[] {
    return Array.from(this.map.values());
  }

  add(...items: T[]) {
    items.forEach((item) => {
      this.map.set(item.id, {
        position: generateDefaultPosition(item.createdAt),
        item,
      });
    });
  }

  delete(id: string) {
    this.map.delete(id);
  }

  move(items: T[], to: T | "top" | "bottom") {
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
      const index = positionedRelations.findIndex(({ item }) => item.id === to.id);
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
}
