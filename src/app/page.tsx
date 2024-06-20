"use client";

import dynamic from "next/dynamic";
import { useContext, useEffect } from "react";

import { DataLoadContext } from "./DataLoadContext";
import { useGraphStore } from "./graph/useGraphStore";
import { useViewStore } from "./view/useViewStore";

import styles from "./page.module.css";

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
  if (!hasLoaded)
    return (
      <div className={styles.LoaderContainer}>
        <span className={styles.Loader}></span> Loading
      </div>
    );

  return <OutlineView outline={viewStore.mainOutlineView} />;
}
