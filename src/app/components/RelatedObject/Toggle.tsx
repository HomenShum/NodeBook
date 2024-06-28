import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";

import { DescendantTreeNode } from "@/app/view/Tree";
import { useTree } from "@/app/view/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./Toggle.module.css";

export default observer(({ treeNode, isHovered }: { treeNode: DescendantTreeNode; isHovered: boolean }) => {
  const tree = useTree();
  return (
    <button
      className={cn(styles.ToggleButton, isHovered && styles.Hovered)}
      onClick={() => {
        tree.togglePathExpanded(treeNode.path);
      }}
    >
      <Play size={7} className={`${styles.Icon} ${treeNode.isExpanded ? styles.ToggleExpanded : ""}`} />
    </button>
  );
});
