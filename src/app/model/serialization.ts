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
