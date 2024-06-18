"use client";

import dynamic from "next/dynamic";
import { useContext, useEffect } from "react";

import { DataLoadContext } from "./DataLoadContext";
import { useGraphStore } from "./graph/useGraphStore";
import { useViewStore } from "./view/useViewStore";

const OutlineView = dynamic(() => import("./components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});

export default function Page() {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  useEffect(() => {
    viewStore.mainOutlineView.setRoot([graphStore.outlineRootRelationFromUserRoot]);
  }, [graphStore.outlineRootRelationFromUserRoot, viewStore.mainOutlineView]);

  const hasLoaded = useContext(DataLoadContext);
  if (!hasLoaded) return <div className="p-4">Loading...</div>;

  return <OutlineView outline={viewStore.mainOutlineView} />;
}
