import { GraphStore } from "@/app/graph/GraphStore";
import { ViewStore } from "@/app/view/ViewStore";

export interface Serializable {
  serialize(): any;
}

export function serializeMap<T extends Serializable>(
  map: Map<string, T>,
): { [key: string]: ReturnType<T["serialize"]> } {
  const result: { [key: string]: ReturnType<T["serialize"]> } = {};
  for (const [key, value] of map.entries()) {
    result[key] = value.serialize();
  }
  return result;
}

export function serializeMapWithArrayValues<T extends Serializable>(
  map: Map<string, T[]>,
): { [key: string]: ReturnType<T["serialize"]>[] } {
  const result: { [key: string]: ReturnType<T["serialize"]>[] } = {};
  for (const [key, value] of map.entries()) {
    result[key] = value.map((v) => v.serialize());
  }
  return result;
}

export const storesToDataString = (graphStore: GraphStore, viewStore: ViewStore) => {
  return JSON.stringify({
    graphStore: graphStore.serialize(),
    viewStore: viewStore.serialize(),
  });
};
