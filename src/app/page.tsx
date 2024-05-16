"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useViewController } from "./controller/useViewController";
import { useGraphStore } from "./store/useGraphStore";

const OutlineView = dynamic(() => import("./components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});

export default function Page() {
  const viewController = useViewController();
  const graphStore = useGraphStore();
  useEffect(() => {
    viewController.setCurrentOutlineViewRoot([graphStore.outlineRootRelationFromUserRoot]);
  });
  return <OutlineView />;
}
