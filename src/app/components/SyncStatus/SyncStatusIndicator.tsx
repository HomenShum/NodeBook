import { Circle } from "lucide-react";
import { observer } from "mobx-react-lite";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { cn } from "@/lib/utils";

import styles from "./SyncStatusIndicator.module.css";

const dateToLabel = (date: Date) => {
  const daysSinceDate = new Date().getDate() - date.getDate();
  return daysSinceDate === 0
    ? `Today, ${date.toLocaleTimeString()}`
    : daysSinceDate === 1
    ? `Yesterday, ${date.toLocaleTimeString()}`
    : `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
};

export const SyncStatusIndicator = observer(function SyncStatusIndicator() {
  const graphStore = useGraphStore();

  const lastSync = graphStore.updateManager.lastSuccessfulSync;
  const lastSyncString = dateToLabel(lastSync);

  const offlineSince = graphStore.updateManager.offlineSince;

  const statusString =
    offlineSince !== null
      ? `Offline.`
      : graphStore.updateManager.numPendingUpdates > 0
      ? "Data syncing..."
      : "All data saved.";
  const tooltip = `${statusString}\nLast sync: ${lastSyncString}`;

  return (
    <span className={cn(styles.SyncStatusIndicator, styles.ShowTooltip, styles.RightAlign)} data-tooltip={tooltip}>
      <Circle
        className={
          graphStore.updateManager.offlineSince !== null
            ? styles.Offline
            : graphStore.updateManager.numPendingUpdates > 0
            ? styles.Syncing
            : styles.Ok
        }
        size={10}
        strokeWidth={1.5}
      />
    </span>
  );
});
