import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { NodeContentEditor } from "@/app/editor/NodeContentEditor";
import { NodeReferenceEditor } from "@/app/editor/NodeReferenceEditor";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./RelatedNodeView.module.css";

export const RelatedNodeView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  return (
    <div className={styles.Container}>
      <div className={styles.ColumnContainer}>
        <div className={styles.FlexContainer}>
          {treeNode.object.isLocal ? (
            <NodeContentEditor treeNode={treeNode} />
          ) : (
            <NodeReferenceView treeNode={treeNode} />
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Displays the node as a non-editable reference pill. The user can place the selection
 * at the end though, so they can add a sibling below it. They can also press backspace
 * to delete the referenced node and replace it with a new one.
 */
const NodeReferenceView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useTree();
  const [isEditing, setIsEditing] = useState(false);

  // Refocus the input when we finish editing
  useEffect(() => {
    if (!isEditing && tree.isNodeFocused(treeNode.id)) {
      inputRef.current?.focus();
    }
  }, [isEditing, tree, treeNode.id]);
  const focusInput = useCallback(() => {
    tree.setFocusedNode(treeNode.id);
  }, [tree, treeNode.id]);

  return (
    <div className={styles.TreeNodeReference} onBlur={() => setIsEditing(false)}>
      {isEditing ? (
        <div className={cn(styles.Pill, styles.Editor)}>
          <NodeReferenceEditor treeNode={treeNode} onClose={focusInput} />
        </div>
      ) : (
        <div className={styles.PillContainer}>
          <div className={styles.Pill}>
            <div onClick={() => tree.togglePathExpanded(treeNode.path)}>{treeNode.object.text}</div>
            <Button
              variant="ghost"
              size="icon"
              className={styles.EditButton}
              onClick={() => {
                setIsEditing(true);
              }}
            >
              <Edit2 size={14} />
            </Button>
          </div>
          <TreeNodeInputSuffix treeNode={treeNode} />
        </div>
      )}
    </div>
  );
});
