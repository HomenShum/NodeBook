import { observer } from "mobx-react-lite";

import { TreeNode } from "@/app/tree/nodes";

import styles from "./ClickToCreateChildrenButton.module.css";

interface Props {
  treeNode: TreeNode;
}

export const ClickToCreateChildrenButton = observer(function ClickToCreateChildrenButton({ treeNode }: Props) {
  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await treeNode.tree
      .createChildNode({
        parent: treeNode,
      })
      .then(({ path }) => {
        treeNode.tree.setFocusedNode(path);
      });
  };

  return (
    <div className={styles.ClickToCreateChildrenButton} onClick={onClick}>
      Empty toggle. Click to add node
    </div>
  );
});
