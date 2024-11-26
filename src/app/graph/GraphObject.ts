import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { PlaceholderGraphObject } from "@/app/graph/PlaceholderGraphObject";

export type GraphObject = GraphNode | GraphRelation | PlaceholderGraphObject;

export const isGraphObject = (obj: any): obj is GraphObject => {
  return obj && obj.objectType;
};
