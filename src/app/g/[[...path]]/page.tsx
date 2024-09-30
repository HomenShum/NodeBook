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
    const object = path ? graphStore.getNode(path[path.length - 1]) : false;
    if (!object) {
      logger.debug("Could not find object, redirecting to home", path);
      return redirect(createRouteUrl("home"));
    }
    const relationPath = parsePathString(path ?? [], graphStore);
    relationPath
      ? viewStore.setRoot(relationPath, "/" + (path ? path.join("/") : ""))
      : viewStore.setRoot(
          {
            relations: [],
            object,
          },
          `/all/${object.id}`,
        );
  }, [graphStore, path, viewStore]);

  return <MainView tree={viewStore.mainView}></MainView>;
}

export default observer(Page);
