"use client";

import dynamic from "next/dynamic";
import { useContext, useEffect } from "react";
import { DataLoadContext } from "./DataLoadContext";
import { useViewController } from "./controller/useViewController";
import { useGraphStore } from "./model/useGraphStore";

const OutlineView = dynamic(() => import("./components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});

export default function Page() {
  const viewController = useViewController();
  const graphStore = useGraphStore();
  useEffect(() => {
    viewController.setCurrentOutlineViewRoot([graphStore.outlineRootRelationFromUserRoot]);
  });

  const hasLoaded = useContext(DataLoadContext);
  if (!hasLoaded) return <div className="p-4">Loading...</div>;

  return <OutlineView />;
}
