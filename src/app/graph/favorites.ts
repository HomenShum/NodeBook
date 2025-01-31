import { GraphObject } from "@/app/graph/GraphObject";
import { GraphStore } from "@/app/graph/GraphStore";

function getRelationToFavorites(graphStore: GraphStore, object: GraphObject) {
  return object.relations.find((r) => r.from.id === graphStore.myFavoritesNode.id && r.relationType.id === "child");
}

export function isFavorited(graphStore: GraphStore, object: GraphObject) {
  const relationToFavorites = getRelationToFavorites(graphStore, object);
  return !!relationToFavorites;
}

export async function addToFavorites(graphStore: GraphStore, object: GraphObject) {
  await graphStore.addRelation({ fromId: graphStore.myFavoritesNode.id, toId: object.id });
}

export async function removeFromFavorites(graphStore: GraphStore, object: GraphObject) {
  const relationToFavorites = getRelationToFavorites(graphStore, object);
  if (relationToFavorites) {
    await graphStore.removeRelation({ relationId: relationToFavorites.id });
  }
}
