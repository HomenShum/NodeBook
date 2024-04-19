"use client";
import { generateKeyBetween } from "fractional-indexing";
import { autorun, toJS } from "mobx";
import { v4 as uuidv4 } from "uuid";
import { GraphObject } from "./model/GraphObject";
import { GraphRelation } from "./model/GraphRelation";

export const uuid = () => uuidv4().slice(0, 8);

/**
 * Sorter for fractional indexes.
 * See https://www.npmjs.com/package/fractional-indexing
 *
 * TODO: the need for null handling feels wrong. leaving for now
 */
export function compareFractionIndices(a: string | null, b: string | null) {
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

export function comparePositions(a: Position | null, b: Position | null) {
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.int === b.int) {
    return a.frac < b.frac ? -1 : 1;
  } else {
    return a.int > b.int ? -1 : 1;
  }
}

export function generatePositionBetween(a: Position, b: Position | null) {
  return { int: a.int, frac: generateKeyBetween(a.frac, a.int === b?.int ? b.frac : null) };
}

export function generateDefaultPosition(createdAt: Date) {
  return { int: createdAt.getTime(), frac: generateKeyBetween(null, null) };
}

// probably sketch but fun for now
export function makeAutoSaving<T>(store: T, propertiesToSave: { [K in keyof T]?: boolean }) {
  if (typeof localStorage === "undefined") return;
  (Object.keys(propertiesToSave) as Array<keyof T>).forEach((name) => {
    if (propertiesToSave[name]) {
      const storedJson = localStorage.getItem(String(name));
      if (storedJson) {
        store[name] = JSON.parse(storedJson);
      }
      autorun(() => {
        const value = toJS(store[name]);
        localStorage.setItem(String(name), JSON.stringify(value));
      });
    }
  });
}
export type Position = { int: number; frac: string };

export type PathLink = { parent: GraphObject; child: GraphObject; relation: GraphRelation };

/**
 * @throws if the relations aren't connected
 */
export const relationsPathToParentChild = (relations: GraphRelation[]): PathLink[] => {
  if (relations.length === 0) return [];

  const path: PathLink[] = [];
  relations.forEach((relation, i) => {
    if (i === 0) {
      path.push({ relation, parent: relation.from, child: relation.to });
    } else {
      if (relation.from.id === path[i - 1].child.id) {
        path.push({ relation, parent: relation.from, child: relation.to });
      } else if (relation.to.id === path[i - 1].child.id) {
        path.push({ relation, parent: relation.to, child: relation.from });
      } else {
        throw new Error("Path is not continuous");
      }
    }
  });
  return path;
};

export const relationsToPathStr = (relations: GraphRelation[]) => {
  return relations.map((r) => r.id).join("/");
};
