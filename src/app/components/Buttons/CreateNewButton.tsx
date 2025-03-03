import { Plus } from "lucide-react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Tree } from "@/app/tree/Tree";
import { cn } from "@/lib/utils";

import styles from "./CreateNewButton.module.css";

export function CreateNewButton({ tree }: { tree: Tree }) {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await tree.createChildOfRootAndFocus();
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
