import React from "react";
import { observer } from "mobx-react-lite";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";

import styles from "./LineLoader.module.css";

const LineLoader = observer(function LoadingSpinner({ height }: { height: number }) {
  const graphStore = useGraphStore();
  if (graphStore.inFlightSearchCount <= 0) return <></>;
  return <div style={{ height: `${height}px` }} className={styles.Loader}></div>;
});

export default LineLoader;
