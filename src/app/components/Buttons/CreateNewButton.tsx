import { Plus } from "lucide-react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Tree } from "@/app/tree/Tree";
import { cn } from "@/lib/utils";

import styles from "./CreateNewButton.module.css";

export function CreateNewButton({ tree }: { tree: Tree }) {
  return (
    <Button
      className={cn(styles.ShowTooltip, styles.ToLeftAlign)}
      data-tooltip="Add node"
      variant="ghostSmooth"
      size="xs"
      onClick={async (e) => {
        e.stopPropagation();
        await tree.createChildOfRootAndFocus();
      }}
    >
      <Plus size={14}></Plus>
    </Button>
  );
}
