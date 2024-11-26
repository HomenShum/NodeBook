import { CircleCheck, CircleEllipsis } from "lucide-react";
import { observer } from "mobx-react-lite";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { cn } from "@/lib/utils";

import styles from "./SyncStatusIndicator.module.css";

export const SyncStatusIndicator = observer(function SyncStatusIndicator() {
  const graphStore = useGraphStore();

  return (
    <span
      className={cn(styles.SyncStatusIndicator, styles.ShowTooltip, styles.RightAlign)}
      data-tooltip={graphStore.updateManager.hasPendingUpdates ? "Data syncing..." : "All data saved"}
    >
      {graphStore.updateManager.hasPendingUpdates ? (
        <CircleEllipsis size={14} strokeWidth={1.5} />
      ) : (
        <CircleCheck size={14} strokeWidth={1.5} />
      )}
    </span>
  );
});
