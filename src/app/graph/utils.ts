import { GraphRelation } from "@/app/graph/GraphRelation";
import { BaseGroup, DescendantTreeNode, GroupId, PinnedGroup } from "@/app/tree/nodes";

const getSide = (relation: GraphRelation, id: string): "from" | "to" | undefined => {
  if (relation.from.id === id) {
    return "from";
  } else if (relation.to.id === id) {
    return "to";
  }
};

const getOtherSide = (relation: GraphRelation, id: string): "from" | "to" | undefined => {
  const side = getSide(relation, id);
  switch (side) {
    case "from":
      return "to";
    case "to":
      return "from";
    default:
      return undefined;
  }
};

/**
 * Returns the side of the relation the id is on or throws an error if the id is not in the relation.
 */
export const getSideOrThrow = (relation: GraphRelation, id: string): "from" | "to" => {
  const side = getSide(relation, id);
  if (side) {
    return side;
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

export const getOtherObject = (relation: GraphRelation, id: string) => {
  const side = getOtherSide(relation, id);
  return side ? relation[side] : undefined;
};

export const extractGroupId = (group: BaseGroup): GroupId => {
  return group instanceof PinnedGroup ? "pinned" : "all";
};

export const extractPointedAtObjectId = (node: DescendantTreeNode): string => {
  return node.relationWithParent.from.id === node.object.id
    ? node.relationWithParent.to.id
    : node.relationWithParent.from.id;
};
