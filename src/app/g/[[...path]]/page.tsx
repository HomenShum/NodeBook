"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

import { OutlineView } from "@/app/components/OutlineView";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { createRouteUrl, parsePathString } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

export default function Page({ params: { path } }: { params: { path: string[] | undefined } }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  useEffect(() => {
    const relationPath = parsePathString(path ?? [], graphStore);
    if (relationPath === null) {
      return redirect(createRouteUrl("home"));
    }
    viewStore.mainView.setRoot(relationPath, "/" + (path ? path.join("/") : ""));
  }, [graphStore, path, viewStore.mainView]);
  return <OutlineView tree={viewStore.mainView}></OutlineView>;
}
