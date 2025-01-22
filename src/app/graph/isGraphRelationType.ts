import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelationType } from "@/app/graph/types";

export function isGraphRelationType(obj: GraphObject | GraphRelationType | undefined): boolean {
  return (
    (typeof obj === "object" &&
      obj.hasOwnProperty("id") &&
      obj.hasOwnProperty("label") &&
      obj.hasOwnProperty("reverseLabel")) ||
    (obj instanceof GraphNode &&
      obj.relations.filter((relation) => {
        return relation.relationTypeId === defaultRelationTypes.__reverse__.id && relation.from.id === obj.id;
      }).length >= 1)
  );
}
