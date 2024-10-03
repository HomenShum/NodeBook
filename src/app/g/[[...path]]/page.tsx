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

    if (relationPath) {
      return viewStore.setRoot(relationPath, "/" + (path ? path.join("/") : ""));
    }

    const object = path ? graphStore.getNode(path[path.length - 1]) : false;

    if (!object) {
      logger.debug("Could not find object, redirecting to home", path);
      return redirect(createRouteUrl("home"));
    }

    viewStore.setRoot({ relations: [], object }, `/all/${object.id}`);
    // We only want to set root in the view store to match the path on initial load. Once the
    // app is loaded, the app is responsible for updating both the view store and the url.
    // To match that, we only run this effect when viewStore or graphStore are instantiated
    // and specifically exclude path as a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStore, graphStore]);

  return <MainView tree={viewStore.mainView}></MainView>;
}

export default observer(Page);
