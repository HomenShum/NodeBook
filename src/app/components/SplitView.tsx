import { observer } from "mobx-react-lite";

import { useViewStore } from "@/app/view/useViewStore";

import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

import styles from "./Splitview.module.css";

export const SplitView = observer(() => {
  const viewStore = useViewStore();
  return (
    <div className={`${styles.Container}`}>
      <div className={styles.SplitContent}>
        <div className={styles.HalfWidth}>
         <ThoughtstreamView tree={viewStore.mainStreamView} />
        </div>
        <div className={styles.Divider}></div>
        <div className={styles.HalfWidth}>
          <OutlineView tree={viewStore.mainOutlineView} />
        </div>
      </div>
    </div>
  );
});
