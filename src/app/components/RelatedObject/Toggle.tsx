import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";

import { DescendantTreeNode, useTree } from "@/app/view/Tree";

import styles from "./Toggle.module.css";

export default observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const tree = useTree();
  return (
    <button
      className={styles.ToggleButton}
      onClick={() => {
        tree.togglePathExpanded(treeNode.path);
      }}
    >
      <Play size={8} className={`${styles.Icon} ${treeNode.isExpanded ? styles.ToggleExpanded : ""}`} />
    </button>
  );
});
