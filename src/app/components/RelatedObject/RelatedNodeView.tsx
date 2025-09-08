import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { MouseEvent, useRef } from "react";

import { TreeNodeInputPrefix } from "@/app/components/RelatedObject/TreeNodeInputPrefix";
import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useUser } from "@/app/contexts/UserContext";
import { NodeEditor } from "@/app/editor/NodeContentEditor";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import { getCanonicalPath, objectPathToBreadcrumb } from "@/app/graph/utils";
import { useDoubleClick } from "@/app/hooks/useDoubleClick";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { cn } from "@/lib/utils";

import styles from "./styles/RelatedNodeView.module.css";
import { nodeIconMap } from "./utils/nodeIconMap";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedNodeView = observer(function RelatedNodeView({ treeNode }: Props) {
  const user = useUser();
  const tree = treeNode.tree;
  const editorRef = useRef<HTMLDivElement>(null);

  const isAtCanonicalPath = treeNode.isAtCanonicalPath;

  const isExpanded = tree.isPathExpanded(treeNode.path);

  const isEditMode =
    tree.selection?.type === "editor" ? tree.selection.treeNodeId === treeNode.id && !!tree.selection.editMode : false;
  const isReadOnlyReference = !treeNode.isAtCanonicalPath && !isEditMode;
  const objectIsGraphNode = treeNode.object instanceof GraphNode;
  const objectIsEditRestricted = treeNode.object.isEditRestricted;

  const iconString = treeNode.object.iconString;
  let IconComponent = null;
  if (iconString && nodeIconMap[iconString]) {
    IconComponent = nodeIconMap[iconString];
  }

  const allowAnonymousAppend =
    treeNode.tree.rootObject instanceof GraphNode &&
    treeNode.tree.rootObject.accessMode === AccessMode.APPEND &&
    treeNode.object.authorId === user.id;

  const editableEditor =
    (!user.isAnonymous || allowAnonymousAppend) &&
    objectIsGraphNode &&
    (isAtCanonicalPath || isEditMode) &&
    !objectIsEditRestricted &&
    treeNode.isEditable;

  const outerShouldBeColumn = isAtCanonicalPath && !objectIsEditRestricted;
  const cnOuterContainer = cn(
    outerShouldBeColumn && styles.ColumnContainer,
    !outerShouldBeColumn && styles.TreeNodeReference,
    isReadOnlyReference && styles.PillContainer,
  );

  const cnInnerContainer = cn({
    [styles.FlexContainer]: true,
    [styles.ShowTooltip]: true,
    [styles.Pill]: !isAtCanonicalPath && !objectIsEditRestricted,
    [styles.Editor]: !isAtCanonicalPath && isEditMode,
    [styles.Expanded]: !isAtCanonicalPath && !isEditMode && isExpanded,
    [styles.StrikeThrough]: treeNode.isTodoItem && treeNode.object instanceof GraphNode && treeNode.object.isChecked,
    [styles.RestrictedNodeContainer]: objectIsEditRestricted,
  });

  const path = getCanonicalPath(treeNode.object);
  const breadcrumbs = objectPathToBreadcrumb(path);
  const tooltipContent = `Node ID: ${treeNode.object.id}
    ${breadcrumbs.join(" / ")}
  `;

  const handleClick = useDoubleClick({
    onSingleClick: () => {
      tree.togglePathExpanded(treeNode.path);
    },
    onDoubleClick: (e) => {
      const element = editorRef.current;
      if (!element) return;

      const text = element.textContent || "";
      const selection = window.getSelection();

      if (selection && element.firstChild) {
        // Get click position relative to the element
        const rect = element.getBoundingClientRect();
        const x = (e as MouseEvent).clientX - rect.left;

        // Estimate the clicked character position
        const charWidth = rect.width / text.length;
        const charPosition = Math.min(Math.floor(x / charWidth), text.length);

        tree.setFocusedNode(treeNode.id, { anchorOffset: charPosition, focusOffset: charPosition }, true);
      }
    },
  });

  return (
    <div
      className={styles.Container}
      onPointerDown={(e) => {
        // Handle shift-click to select nodes between current selection and clicked node
        if (e.shiftKey && !tree.isNodeFocused(treeNode.id)) {
          e.stopPropagation();
          e.preventDefault();
          tree.handleShiftClickSelection(treeNode.id);
        }
      }}
    >
      <div className={cnOuterContainer}>
        {(!isAtCanonicalPath || objectIsEditRestricted) && !user.isAnonymous && (
          <TreeNodeInputPrefix treeNode={treeNode} isEditorEditable={editableEditor} />
        )}
        <div
          className={cnInnerContainer}
          onClick={(e) => {
            if (isReadOnlyReference || objectIsEditRestricted) {
              e.stopPropagation();
              e.preventDefault();
              if (objectIsEditRestricted) {
                // For edit-restricted nodes, just toggle expand/collapse
                tree.togglePathExpanded(treeNode.path);
              } else {
                handleClick(e);
              }
            }
          }}
          onPointerDown={(e) => {
            if (isReadOnlyReference || objectIsEditRestricted) {
              e.stopPropagation();
              if (objectIsEditRestricted) {
                e.preventDefault();
              }
            }

            // Handle shift-click to select nodes between current selection and clicked node
            if (e.shiftKey && !tree.isNodeFocused(treeNode.id)) {
              e.stopPropagation();
              e.preventDefault();
              tree.handleShiftClickSelection(treeNode.id);
            }
          }}
          onMouseDown={(e) => {
            if (objectIsEditRestricted) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          data-tooltip={tooltipContent}
        >
          {objectIsEditRestricted ? (
            <div className={styles.RestrictedNode} data-tooltip={tooltipContent}>
              {IconComponent && <IconComponent size={14} />}
              {treeNode.object.text}
            </div>
          ) : (
            <NodeEditor treeNode={treeNode} isEditorEditable={editableEditor} editorRef={editorRef} />
          )}
          {isReadOnlyReference && !user.isAnonymous && treeNode.isEditable && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="top" align="center" sideOffset={4}>
                  Edit node
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {(!isAtCanonicalPath || objectIsEditRestricted) && !user.isAnonymous && (
          <TreeNodeInputSuffix treeNode={treeNode} isEditorEditable={editableEditor} />
        )}
      </div>
    </div>
  );
});
