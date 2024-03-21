"use client";
import { autorun, toJS } from "mobx";
import { v4 as uuidv4 } from "uuid";

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
