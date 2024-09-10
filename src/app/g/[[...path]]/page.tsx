"use client";
import { observer } from "mobx-react-lite";
import { redirect } from "next/navigation";
import { useEffect } from "react";

import { MainView } from "@/app/components/MainView";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { createRouteUrl, parsePathString } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";

function Page({ params: { path } }: { params: { path: string[] | undefined } }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  useEffect(() => {
    const relationPath = parsePathString(path ?? [], graphStore);
    if (relationPath === null) {
      logger.debug("Could not parse path, redirecting to home", path);
      return redirect(createRouteUrl("home"));
    }
    viewStore.setRoot(relationPath, "/" + (path ? path.join("/") : ""));
  }, [graphStore, path, viewStore]);

  return <MainView tree={viewStore.mainView}></MainView>;
}

export default observer(Page);
