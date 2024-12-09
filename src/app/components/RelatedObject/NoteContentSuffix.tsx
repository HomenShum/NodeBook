import { observer } from "mobx-react-lite";
import React from "react";

import { useHandleEnterKey } from "@/app/editor/plugins/EnterKeyPlugin";
import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./styles/RelatedObjectView.module.css";

type Props = {
  treeNode: DescendantTreeNode;
};

/**
 * Renders an invisible input at the end of note content to allow
 * for easy navigation between note content and note content suffix.
 */
export const NoteContentSuffix = observer(function NoteContentSuffix({ treeNode }: Props) {
  const tree = treeNode.tree;
  const handleEnterKey = useHandleEnterKey(tree, treeNode);

  return (
    <div style={{ height: "20px", width: "100%", bottom: 0, position: "absolute", alignItems: "end" }}>
      <input
        className={styles.NoteContentSuffix}
        onKeyDown={async (e: React.KeyboardEvent) => {
          const isMod = e.metaKey || e.ctrlKey;
          switch (e.key) {
            case "Enter": {
              return handleEnterKey(e.nativeEvent);
            }
            case "Backspace":
              try {
                e.preventDefault();
                await tree.replaceObjectAtNodeWithCopy(treeNode.id);
                tree.setFocusedNode(treeNode.id);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unknown error");
              }
              break;
            case "ArrowRight":
            case "ArrowDown":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              if (isMod && e.shiftKey) {
                tree.moveSelectedNodesDown();
                break;
              }
              isMod ? tree.expandAtSelection() : tree.moveEditorSelectionDown("start");
              break;
            case "ArrowUp":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("start");
              break;
            case "ArrowLeft":
              e.preventDefault();
              tree.setFocusedNode(treeNode.visibleChildren[treeNode.visibleChildren.length - 1].path, "end");
              break;
          }
        }}
        // Prevent the input from being editable
        onChange={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        value=""
        type="text"
      />
    </div>
  );
});
