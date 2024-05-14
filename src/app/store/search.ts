import { search } from "fast-fuzzy";
import { GraphObject } from "../model/GraphObject";

export type SearchResult = { display: boolean; expandChildren: boolean };
type TemporarySearchResult = SearchResult | null;

export function searchGraph(obj: GraphObject, query: string): Map<string, SearchResult> {
  const result = new Map<string, TemporarySearchResult>();
  searchRecursively(obj, query, result);
  return result as Map<string, SearchResult>;
}

// search the children of the node for the query
function searchRecursively(node: GraphObject, query: string, result: Map<string, TemporarySearchResult>): boolean {
  const matches = new Set(
    search(query, node.connectedObjects(), { keySelector: (node) => node.text }).map((node) => node.id),
  );

  let hasNestedMatch = false;
  for (const child of node.connectedObjects()) {
    if (result.has(child.id)) {
      // null means that the child is currently being evaluated higher up in the call stack
      // so ignore it
      if (result.get(child.id) !== null) {
        const childResult = result.get(child.id)!;
        hasNestedMatch = hasNestedMatch || childResult.display;
      }
      continue;
    }
    result.set(child.id, null);

    const childContainsNestedMatch = searchRecursively(child, query, result);
    const childMatches = childContainsNestedMatch || matches.has(child.id);

    result.set(child.id, { expandChildren: childContainsNestedMatch, display: childMatches });
    hasNestedMatch = hasNestedMatch || childMatches;
  }

  return hasNestedMatch;
}
