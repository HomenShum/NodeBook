import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef } from "react";

import { TreeNodeInputPrefix } from "@/app/components/RelatedObject/TreeNodeInputPrefix";
import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useUser } from "@/app/contexts/UserContext";
import { NodeEditor } from "@/app/editor/NodeContentEditor";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { cn } from "@/lib/utils";

import styles from "./styles/RelatedNodeView.module.css";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedNodeView = observer(function RelatedNodeView({ treeNode }: Props) {
  const user = useUser();
  const tree = treeNode.tree;
  const ref = useRef<HTMLDivElement>(null);

  const isLocal = treeNode.object.isLocal;
  const isGlobal = treeNode.object.isGlobal;
  const isExpanded = tree.isPathExpanded(treeNode.path);

  const isEditMode =
    tree.selection?.type === "editor" ? tree.selection.treeNodeId === treeNode.id && !!tree.selection.editMode : false;
  const isReadOnlyReference = isGlobal && !isEditMode;
  const objectIsGraphNode = treeNode.object instanceof GraphNode;
  const objectIsEditRestricted = treeNode.object.isEditRestricted;
  const editableEditor = !user.isAnonymous && objectIsGraphNode && (isLocal || isEditMode) && !objectIsEditRestricted;

  const outerShouldBeColumn = isLocal && !objectIsEditRestricted;
  const cnOuterContainer = cn(
    outerShouldBeColumn && styles.ColumnContainer,
    !outerShouldBeColumn && styles.TreeNodeReference,
    isReadOnlyReference && styles.PillContainer,
  );

  const cnInnerContainer = cn(
    styles.FlexContainer,
    isLocal ? "" : isEditMode ? cn(styles.Pill, styles.Editor) : cn(isExpanded && styles.Expanded, styles.Pill),
    treeNode.isTodoItem && treeNode.object instanceof GraphNode && treeNode.object.isChecked ? cn(styles.StrikeThrough) : ""
  );

  return (
    <div ref={ref} className={styles.Container}>
      <div className={cnOuterContainer}>
        {(isGlobal || objectIsEditRestricted) && !user.isAnonymous && (
          <TreeNodeInputPrefix treeNode={treeNode} isEditorEditable={editableEditor} />
        )}
        <div
          className={cnInnerContainer}
          onPointerDown={(e) => {
            if (isReadOnlyReference) {
              e.stopPropagation();
              tree.togglePathExpanded(treeNode.path);
            }
          }}
        >
          <NodeEditor treeNode={treeNode} isEditorEditable={editableEditor} boundaryRef={ref} />
          {isReadOnlyReference && !user.isAnonymous && (
            <Button
              variant="ghost"
              size="icon"
              className={styles.EditButton}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                tree.setFocusedNode(treeNode.id, "end", true);
              }}
            >
              <Edit2 size={14} />
            </Button>
          )}
        </div>
        {(isGlobal || objectIsEditRestricted) && !user.isAnonymous && (
          <TreeNodeInputSuffix treeNode={treeNode} isEditorEditable={editableEditor} />
        )}
      </div>
    </div>
  );
});
