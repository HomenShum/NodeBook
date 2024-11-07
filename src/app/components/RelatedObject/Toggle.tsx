import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";

import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { cn } from "@/lib/utils";

import styles from "./styles/Toggle.module.css";

interface Props {
  treeNode: DescendantTreeNode;
  isHovered: boolean;
}

export default observer(function Toggle({ treeNode, isHovered }: Props) {
  const tree = useTree();
  return (
    <button
      className={cn(styles.ToggleButton, isHovered && styles.Hovered)}
      onPointerDown={() => {
        tree.togglePathExpanded(treeNode.path);
      }}
    >
      <Play size={7} className={`${styles.Icon} ${treeNode.isExpanded ? styles.ToggleExpanded : ""}`} />
    </button>
  );
});
