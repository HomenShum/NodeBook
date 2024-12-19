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
  const [clickedBkspc, setClickedBckspc] = React.useState(false);
  const handleEnterKey = useHandleEnterKey(tree, treeNode);
  const handleBackspaceKey = async (e: Event) => {
    if (clickedBkspc) {
      await tree.replaceObjectAtNodeWithCopy(treeNode.id);
      tree.setFocusedNode(treeNode.id);
      setClickedBckspc(false);
    } else {
      setClickedBckspc(true);
      // Select the node with proper Id and set the background color
      const node = document.getElementById(treeNode.id + "-noteContent");
      if (node) {
        node.style.backgroundColor = "var(--teal-a3)";
      }
    }
  };

  return (
    <div style={{ height: "20px", width: "100%", bottom: 0, position: "absolute", alignItems: "end" }}>
      <input
        className={styles.NoteContentSuffix}
        data-note-suffix={treeNode.object.id}
        onKeyDown={async (e: React.KeyboardEvent) => {
          const isMod = e.metaKey || e.ctrlKey;
          switch (e.key) {
            case "Enter": {
              return handleEnterKey(e.nativeEvent);
            }
            case "Backspace":
              try {
                e.preventDefault();
                await handleBackspaceKey(e.nativeEvent);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unknown error");
              }
              break;
            case "ArrowRight":
            case "ArrowDown":
              e.preventDefault();
              e.stopPropagation();
              const nextNode = treeNode.siblingBelow;
              if (isMod && e.shiftKey) {
                tree.moveSelectedNodesDown();
                break;
              }
              isMod
                ? tree.expandAtSelection()
                : nextNode
                ? tree.setFocusedNode(nextNode?.id, "start")
                : tree.moveEditorSelectionDown("start");
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
        onBlur={(e) => {
          const node = document.getElementById(treeNode.id + "-noteContent");
          if (node) {
            node.style.removeProperty("background-color");
            setClickedBckspc(false);
          }
        }}
        value=""
        type="text"
      />
    </div>
  );
});
