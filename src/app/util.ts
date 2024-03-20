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
