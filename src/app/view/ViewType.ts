import { GraphRelation } from "@/app/graph/GraphRelation";

export enum ViewType {
  GRAPH = "g",
  STREAM = "stream",
}

export function isViewType(viewType: string): viewType is ViewType {
  return Object.values(ViewType).includes(viewType as ViewType);
}

export function createRouteUrl(viewType: ViewType, ...path: string[] | GraphRelation[]): string {
  const pathString = path.map((p) => (typeof p === "string" ? p : p.id)).join("/");
  return `/${viewType}/${pathString}`;
}
