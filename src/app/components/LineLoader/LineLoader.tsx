import { observer } from "mobx-react-lite";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";

import styles from "./LineLoader.module.css";

const LineLoader = observer(function LoadingSpinner({ height }: { height: number }) {
  const graphStore = useGraphStore();
  if (graphStore.inFlightSearchCount <= 0) return <></>;
  return (
    <div
      style={{ height: `${height}px`, minHeight: `${height}px` }}
      className={styles.Loader}
      id="CommandBarLoader" // This is important for the test:command-bar script
    ></div>
  );
});

export default LineLoader;
