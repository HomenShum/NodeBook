import { Plus } from "lucide-react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Tree } from "@/app/tree/Tree";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./CreateNewButton.module.css";

export function CreateNewButton({ tree }: { tree: Tree }) {
  const viewStore = useViewStore();

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { node, path } = await tree.createChildOfRootAndFocus();

    if (viewStore.isDeepSearching) {
      // Temporarily add it to the search view if we're in search view
      viewStore.searchView.addTempPath(node, path);
    }
  };

  return (
    <div className={styles.FullWidthWrapper} onClick={handleClick}>
      <Button
        className={cn(styles.ShowTooltip, styles.ToLeftAlign)}
        data-tooltip="Add node"
        variant="ghostSmooth"
        size="xs"
        onClick={handleClick}
      >
        <Plus size={14}></Plus>
      </Button>
    </div>
  );
}
