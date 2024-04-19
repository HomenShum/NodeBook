import { search } from "fast-fuzzy";
import { GraphObject } from "../model/GraphObject";

export function searchGraph(obj: GraphObject, query: string): Map<string, boolean> {
  const result = new Map();
  searchRecursively(obj, query, result);
  return result;
}

// search the children of the node for the query
function searchRecursively(node: GraphObject, query: string, result: Map<string, boolean>): boolean {
  const matches = new Set(search(query, node.children, { keySelector: (node) => node.text }).map((node) => node.id));

  let hasNestedMatch = false;
  for (const child of node.children) {
    if (result.has(child.id)) {
      hasNestedMatch = hasNestedMatch || result.get(child.id)!;
      continue;
    }

    const childContainsNestedMatch = searchRecursively(child, query, result);
    const childMatches = childContainsNestedMatch || matches.has(child.id);

    result.set(child.id, childMatches);
    hasNestedMatch = hasNestedMatch || childMatches;
  }

  return hasNestedMatch;
}
