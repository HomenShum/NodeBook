import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useHandleEnterKey } from "@/app/editor/plugins/EnterKeyPlugin";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./styles/RelatedObjectView.module.css";

type Props = {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
};

/**
 * Renders an invisible input at the end of a tree node, allowing user
 * interaction with non-editable content. This allows the user to still focus
 * the node and enabling actions like splitting nodes.
 *
 * When isEditorEditable is false, it becomes responsible for grabbing the
 * selection in response to tree selection changes.
 *
 * Todo: This is pretty similar to TreeNodeInputPrefix.
 * Maybe make a input sandwich wrapper and pass NodeEditor as child?
 */
export const NoteContentSuffix = observer(function TreeNodeInputSuffix({ treeNode, isEditorEditable }: Props) {
  const tree = treeNode.tree;
  const inputRef = useRef<HTMLInputElement>(null);
  const graphStore = useGraphStore();
  const viewType = useViewStore().viewType;
  const handleEnterKey = useHandleEnterKey(tree, treeNode);

  // Only grab selection if  tree node
  const treeNodeShouldHaveFocus = tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id;
  const isEndPosition = tree.selection?.type === "editor" && tree.selection.position === "end";
  useEffect(() => {
    if (!isEditorEditable) {
      const inputFocused = inputRef.current?.contains(document.activeElement);
      if (!inputFocused && treeNodeShouldHaveFocus && isEndPosition) {
        inputRef.current?.focus();
      } else if (inputFocused && !treeNodeShouldHaveFocus) {
        inputRef.current?.blur();
      }
    }
  }, [treeNodeShouldHaveFocus, isEditorEditable, isEndPosition]);

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
        onClick={(e) => {
          inputRef.current?.focus();
        }}
        ref={inputRef}
        type="text"
      />
    </div>
  );
});
