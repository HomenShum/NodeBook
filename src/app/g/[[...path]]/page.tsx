"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

import { OutlineView } from "@/app/components/OutlineView";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { createRouteUrl, parsePathString } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { ViewType } from "@/app/view/ViewType";

export default function Page({ params: { path } }: { params: { path: string[] | undefined } }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  useEffect(() => {
    const relationPath = parsePathString(path ?? [], graphStore);
    if (relationPath === null) {
      return redirect(createRouteUrl(ViewType.GRAPH, "home"));
    }
    viewStore.mainOutlineView.setRoot(relationPath);
  }, [graphStore, path, viewStore.mainOutlineView]);
  return <OutlineView tree={viewStore.mainOutlineView}></OutlineView>;
}
