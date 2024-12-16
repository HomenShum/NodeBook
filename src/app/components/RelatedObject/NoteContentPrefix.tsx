import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./styles/RelatedObjectView.module.css";

type Props = {
  treeNode: DescendantTreeNode;
  openRelComboBox: () => void;
};

/**
 * Renders an invisible input at the beginning of note content to allow
 * for easy navigation between note content and note content prefix.
 */
export const NoteContentPrefix = observer(function NoteContentPrefix({ treeNode, openRelComboBox }: Props) {
  const tree = treeNode.tree;
  const inputRef = useRef<HTMLInputElement>(null);
  const focusOnNode = function () {
    inputRef.current?.focus();
  };

  // Only grab selection if  tree node
  const treeNodeShouldHaveFocus = tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id;
  const isEndPosition = tree.selection?.type === "editor" && tree.selection.position === "end";
  useEffect(() => {
    const inputFocused = inputRef.current?.contains(document.activeElement);

    if (!inputFocused && treeNodeShouldHaveFocus && isEndPosition) {
      inputRef.current?.focus();
    } else if (inputFocused && !treeNodeShouldHaveFocus) {
      inputRef.current?.blur();
    }
  }, [treeNodeShouldHaveFocus, isEndPosition, tree]);

  return (
    <div style={{ height: "20px", width: "100%", bottom: 0, position: "absolute", alignItems: "end" }}>
      <input
        data-note-prefix={treeNode.object.id}
        className={styles.NoteContentPrefix}
        onKeyDown={async (e: React.KeyboardEvent) => {
          switch (e.key) {
            case "Enter": {
              // Create child node above the current node
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              const nodeAbove = treeNode.siblingAbove;
              if (nodeAbove) {
                tree.createChildNode({ parent: treeNode.parent, after: nodeAbove });
              }
            }
            case "ArrowRight":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              tree.setFocusedNode(treeNode.childrenGroupsById["noteContent"].nodes[0].id, "start");
              break;
            case "ArrowDown":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              tree.moveEditorSelectionDown("start");
              break;
            case "ArrowUp":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("start");
              break;
            case "ArrowLeft":
              e.preventDefault();
              tree.moveEditorSelectionUp("end");
              break;
            default:
              e.preventDefault();
              e.stopPropagation();
              openRelComboBox();
              break;
          }
        }}
        ref={inputRef}
        type="text"
        onChange={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        value=""
      />
    </div>
  );
});
