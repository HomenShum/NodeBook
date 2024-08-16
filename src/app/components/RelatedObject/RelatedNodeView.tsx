import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { NodeEditor } from "@/app/editor/NodeContentEditor";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./RelatedNodeView.module.css";

export const RelatedNodeView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const tree = useTree();

  const isLocal = treeNode.object.isLocal;
  const isExpanded = tree.isPathExpanded(treeNode.path);

  const [isEditable, setIsEditable] = useState(isLocal || tree.isNodeFocused(treeNode.id));
  const isNonEditableMention = !isLocal && !isEditable;

  const cnOuterContainer = cn(
    isLocal && styles.ColumnContainer,
    !isLocal && styles.TreeNodeReference,
    isNonEditableMention && styles.PillContainer,
  );

  const cnInnerContainer = cn(
    styles.FlexContainer,
    isLocal ? "" : isEditable ? cn(styles.Pill, styles.Editor) : cn(isExpanded && styles.Expanded, styles.Pill),
  );

  const focusNonLocalNode = () => {
    setIsEditable(true);
    setTimeout(() => tree.setFocusedNode(treeNode.id), 50);
  };

  return (
    <div className={styles.Container}>
      <div className={cnOuterContainer}>
        <div
          className={cnInnerContainer}
          onClick={() => {
            if (isNonEditableMention) tree.togglePathExpanded(treeNode.path);
          }}
        >
          <NodeEditor treeNode={treeNode} isEditable={isEditable} setIsEditable={setIsEditable} />
          {isNonEditableMention && (
            <Button
              variant="ghost"
              size="icon"
              className={styles.EditButton}
              onClick={(e) => {
                e.stopPropagation(); // Prevent the node from expanding/collapsing
                focusNonLocalNode();
              }}
            >
              <Edit2 size={14} />
            </Button>
          )}
        </div>
        {isNonEditableMention && <TreeNodeInputSuffix treeNode={treeNode} backspaceCallback={focusNonLocalNode} />}
      </div>
    </div>
  );
});
