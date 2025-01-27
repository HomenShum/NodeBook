"use client";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { MainView } from "@/app/components/MainView";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { parsePathArray } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";

function Page({ params: { path: pathArray } }: { params: { path: string[] | undefined } }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();

  useEffect(() => {
    const path = parsePathArray(pathArray ?? [], graphStore);
    // If the path is valid, keep the path, and update our view state to match
    // Otherwise, we redirect to the specified object or the default root
    if (path) {
      viewStore.setRoot(path.objectPath);
      if (path.objectPath.object.id) {
        graphStore.layerManager.loadCanonicalWithIds([path.objectPath.object.id]);
        graphStore.layerManager.loadWithIds([path.objectPath.object.id]);
      }
    } else {
      if (pathArray) {
        graphStore.layerManager.loadCanonicalWithIds([pathArray[pathArray.length - 1]]);
        graphStore.layerManager.loadWithIds([pathArray[pathArray.length - 1]]);
      }
      const object = pathArray ? graphStore.getNode(pathArray[pathArray.length - 1]) : false;
      if (object) {
        setRoot(object);
      } else {
        logger.debug("Could not find object, redirecting to home", pathArray);
        setRoot(graphStore.getDefaultRootForUser());
      }
    }
    // We only want to set root in the view store to match the path on initial load. Once the
    // app is loaded, the app is responsible for updating both the view store and the url.
    // To match that, we only run this effect when viewStore or graphStore are instantiated
    // and specifically exclude path as a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStore, graphStore, setRoot]);

  return <MainView tree={viewStore.mainView}></MainView>;
}

export default observer(Page);
