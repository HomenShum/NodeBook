import { Dot } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";

import styles from "@/app/components/RelatedObject/styles/RelatedObjectView.module.css";
import { RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

interface Props {
  treeNode: RootTreeNode;
}

export const ClickToCreateNodeButton = observer(function ClickToCreateNodeButton({ treeNode }: Props) {
  const tree = useTree();
  const handleCreateAndFocusNode = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      tree.createChildOfRootAndFocus();
    },
    [tree],
  );

  if (treeNode.childCount !== 0) return null;

  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)} onClick={handleCreateAndFocusNode}>
      <div className={styles.RelatedObjectContent}>
        <div className={cn(styles.RelatedObjectBulletContainer)}>
          <Dot strokeWidth={5} height={16} className={cn(styles.Bullet, styles.DotInsideClickToCreateNode)} />
        </div>
        <div className={cn(styles.RelatedObjectNode)}>
          <div className={styles.ClickToCreateNode}>Click to create</div>
        </div>
      </div>
    </div>
  );
});
