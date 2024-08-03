export enum ViewType {
  GRAPH = "g",
  STREAM = "stream",
}

export function isViewType(viewType: string): viewType is ViewType {
  return Object.values(ViewType).includes(viewType as ViewType);
}
