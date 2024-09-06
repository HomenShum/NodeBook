import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { NodeEditor } from "@/app/editor/NodeContentEditor";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./RelatedNodeView.module.css";

export const RelatedNodeView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const tree = useTree();
  const graphStore = useGraphStore();

  const isLocal = treeNode.object.isLocal;
  const isExpanded = tree.isPathExpanded(treeNode.path);
  const isMyNode = treeNode.object.authorId === graphStore.user.id;

  const [isEditable, setIsEditable] = useState(isLocal || (tree.isNodeFocused(treeNode.id) && isMyNode));
  const isGlobalReference = !isLocal && !isEditable;

  const cnOuterContainer = cn(
    isLocal && styles.ColumnContainer,
    !isLocal && styles.TreeNodeReference,
    isGlobalReference && styles.PillContainer,
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
            if (isGlobalReference) tree.togglePathExpanded(treeNode.path);
          }}
        >
          <NodeEditor treeNode={treeNode} isEditable={isEditable} setIsEditable={setIsEditable} />
          {isGlobalReference && isMyNode && (
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
        {isGlobalReference && <TreeNodeInputSuffix treeNode={treeNode} />}
      </div>
    </div>
  );
});
