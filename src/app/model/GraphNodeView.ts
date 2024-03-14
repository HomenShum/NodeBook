import { GraphNode } from "./GraphNode";

export type GraphNodeViewType = "bullet" | "note";

export interface GraphNodeView {
  type: GraphNodeViewType;
  id: string;
  graphNode: GraphNode;
  isFocused: boolean;
}
