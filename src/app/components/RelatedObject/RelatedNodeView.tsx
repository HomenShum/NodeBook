import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef } from "react";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { NodeEditor } from "@/app/editor/NodeContentEditor";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./styles/RelatedNodeView.module.css";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedNodeView = observer(function RelatedNodeView({ treeNode }: Props) {
  const tree = useTree();
  const ref = useRef<HTMLDivElement>(null);

  const isLocal = treeNode.object.isLocal;
  const isExpanded = tree.isPathExpanded(treeNode.path);

  const isEditMode =
    tree.selection?.type === "editor" ? tree.selection.treeNodeId === treeNode.id && !!tree.selection.editMode : false;
  const isReadOnlyReference = treeNode.object.isGlobal && !isEditMode;
  const editableEditor = treeNode.object instanceof GraphNode ? treeNode.object.isLocal || isEditMode : false;

  const cnOuterContainer = cn(
    isLocal && styles.ColumnContainer,
    !isLocal && styles.TreeNodeReference,
    isReadOnlyReference && styles.PillContainer,
  );

  const cnInnerContainer = cn(
    styles.FlexContainer,
    isLocal ? "" : isEditMode ? cn(styles.Pill, styles.Editor) : cn(isExpanded && styles.Expanded, styles.Pill),
  );

  return (
    <div ref={ref} className={styles.Container}>
      <div className={cnOuterContainer}>
        <div
          className={cnInnerContainer}
          onClick={() => {
            if (isReadOnlyReference) tree.togglePathExpanded(treeNode.path);
          }}
        >
          <NodeEditor treeNode={treeNode} isEditorEditable={editableEditor} boundaryRef={ref} />
          {isReadOnlyReference && (
            <Button
              variant="ghost"
              size="icon"
              className={styles.EditButton}
              onClick={(e) => {
                e.stopPropagation(); // Prevent the node from expanding/collapsing
                tree.setFocusedNode(treeNode.id, undefined, undefined, true);
              }}
            >
              <Edit2 size={14} />
            </Button>
          )}
        </div>
        {treeNode.object.isGlobal && <TreeNodeInputSuffix treeNode={treeNode} isEditorEditable={editableEditor} />}
      </div>
    </div>
  );
});
