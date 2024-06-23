import { GraphRelation } from "@/app/graph/GraphRelation";

/**
 * Returns the side of the relation the id is on or throws an error if the id is not in the relation.
 */
export const getSideOrThrow = (relation: GraphRelation, id: string): "from" | "to" => {
  if (relation.from.id === id) {
    return "from";
  } else if (relation.to.id === id) {
    return "to";
  } else {
    throw new Error("Object not connected to relation");
  }
};

/**
 * Returns the other object in the relation or throws an error if the id is not in the relation.
 */
export const getOtherObjectOrThrow = (relation: GraphRelation, id: string) => {
  return getSideOrThrow(relation, id) === "from" ? relation.to : relation.from;
};

/**
 * Returns the other side of the relation the id is on or throws an error if the id is not in the relation.
 */
export const getOtherSideOrThrow = (relation: GraphRelation, id: string): "from" | "to" => {
  return getSideOrThrow(relation, id) === "from" ? "to" : "from";
};
