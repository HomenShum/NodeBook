import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { NodeContentEditor } from "@/app/editor/NodeContentEditor";
import { NodeReferenceEditor } from "@/app/editor/NodeReferenceEditor";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import sEditor from "./RelatedObjectEditor.module.css";
import styles from "./RelatedObjectView.module.css";

export const RelatedNodeView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  return (
    <div className={sEditor.Container}>
      <div className={sEditor.ColumnContainer}>
        <div className={sEditor.FlexContainer}>
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
  const [isHovered, setIsHovered] = useState(false);

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
        <div style={{ display: "flex" }}>
          <div
            className={styles.Pill}
            style={{ display: "flex" }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div onClick={() => tree.togglePathExpanded(treeNode.path)}>{treeNode.object.text}</div>
            {isHovered && (
              <button
                className={styles.EditButton}
                onClick={() => {
                  setIsEditing(true);
                  setIsHovered(false);
                }}
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          <TreeNodeInputSuffix treeNode={treeNode} />
        </div>
      )}
    </div>
  );
});
