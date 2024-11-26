import { Chip } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { BaseGroup, DescendantTreeNode, GroupId, NoteContentGroup, PinnedGroup } from "@/app/tree/nodes";
import { ObjectPath } from "@/app/util";
import { GLOBAL_ROOT_ID } from "@/lib/constants";
import logger from "@/lib/logger";

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
  return group instanceof PinnedGroup ? "pinned" : group instanceof NoteContentGroup ? "noteContent" : "all";
};

export const extractPointedAtObjectId = (node: DescendantTreeNode): string => {
  return node.relationWithParent.from.id === node.object.id
    ? node.relationWithParent.to.id
    : node.relationWithParent.from.id;
};

export const getNextCanonicalRelation = (object: GraphObject) => {
  return object.relations.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] || null;
};

export const getCanonicalPath = (object: GraphObject, maxDepth = 20): ObjectPath => {
  const relations: GraphRelation[] = [];
  let current = object;
  let relation = current.canonicalRelation;
  let relatedObject = relation ? getOtherObject(relation, current.id) : null;
  let depth = 0;

  while (relation && relatedObject && current.id !== GLOBAL_ROOT_ID) {
    relations.push(relation);

    current = relatedObject;
    relation = current.canonicalRelation;
    relatedObject = relation ? getOtherObject(relation, current.id) : null;
    depth++;
    if (depth > maxDepth) {
      logger.error("Max depth reached while getting canonical path", {
        objectId: object.id,
        objectType: object.objectType,
      });
      return { object, relations: [] };
    }
  }

  return {
    object,
    relations: relations.reverse(),
  };
};

export const objectPathToString = (objectPath: ObjectPath): string => {
  if (!objectPath.relations?.length) return "";
  return objectPath.relations.map((r) => "/all/" + r.id).join("");
};

/**
 * Returns a new array of chips that represents a slice of the original chips array
 * between start and end positions. Similar to String.slice() but works with an array
 * of chips while preserving chip boundaries.
 *
 * Mentions and linebreaks are tokens, so their content can't be changed and they are
 * deleted all at once.
 */

export const sliceChips = (chips: Chip[], start: number, end?: number): Chip[] => {
  if (!chips.length) return [];

  const result: Chip[] = [];
  let currentPos = 0;

  // Handle negative indices
  const totalLength = chips.reduce(
    (sum, chip) => sum + (chip.type === "mention" || chip.type === "linebreak" ? 1 : chip.value.length),
    0,
  );
  const actualStart = start < 0 ? Math.max(0, totalLength + start) : start;
  const actualEnd = end === undefined ? totalLength : end < 0 ? totalLength + end : end;

  if (actualStart >= actualEnd) return [];

  for (const chip of chips) {
    const chipLength = chip.type === "mention" || chip.type === "linebreak" ? 1 : chip.value.length;

    if (currentPos + chipLength <= actualStart) {
      // Skip chips before start
      currentPos += chipLength;
      continue;
    }

    if (currentPos >= actualEnd) {
      // Stop after reaching end
      break;
    }

    if (chip.type === "mention" || chip.type === "linebreak") {
      // For mentions and linebreaks - only include if they start within range
      // and end within range (since they have length 1)
      if (currentPos >= actualStart && currentPos + 1 <= actualEnd) {
        result.push(chip);
      }
    } else if (chip.type === "link") {
      // For links - trim the value and url together
      const startInChip = Math.max(0, actualStart - currentPos);
      const endInChip = Math.min(chipLength, actualEnd - currentPos);

      const newValue = chip.value.slice(startInChip, endInChip);
      // Extract protocol if present
      const urlMatch = chip.url.match(/^(https?:\/\/)(.*)$/);
      const protocol = urlMatch ? urlMatch[1] : "";
      const urlWithoutProtocol = urlMatch ? urlMatch[2] : chip.url;
      // Apply trimming only to the URL part after the protocol
      const newUrlWithoutProtocol = urlWithoutProtocol.slice(startInChip, endInChip);
      const newUrl = protocol + newUrlWithoutProtocol;
      result.push({ ...chip, value: newValue, url: newUrl });
    } else {
      // For text chips - trim the value
      const startInChip = Math.max(0, actualStart - currentPos);
      const endInChip = Math.min(chipLength, actualEnd - currentPos);

      const newValue = chip.value.slice(startInChip, endInChip);
      if (newValue) {
        result.push({ ...chip, value: newValue });
      }
    }

    currentPos += chipLength;
  }

  return result;
};
