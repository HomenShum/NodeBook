import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./styles/RelatedObjectView.module.css";

type Props = {
  treeNode: DescendantTreeNode;
  openRelComboBox: () => void;
};

/**
 * Renders an invisible input at the beginning of relation type to allow
 * for easy navigation between relation type and relation type prefix.
 */
export const RelationTypePrefix = observer(function RelationTypePrefix({ treeNode, openRelComboBox }: Props) {
  const tree = treeNode.tree;
  const inputRef = useRef<HTMLInputElement>(null);
  const [clickedBkspc, setClickedBckspc] = React.useState(false);
  const viewStore = useViewStore();
  const handleBackspaceKey = async (e: Event) => {
    // if (clickedBkspc && viewStore.viewType === "outline") {
    //   await tree.replaceObjectAtNodeWithCopy(treeNode.id);
    //   tree.setFocusedNode(treeNode.id);
    //   setClickedBckspc(false);
    // } else {
    //   setClickedBckspc(true);
    //   // Select the node with proper Id and set the background color
    //   const node = document.getElementById(treeNode.id + "-relationType");
    //   if (node) {
    //     node.style.backgroundColor = "var(--teal-a3)";
    //   }
    // }
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
    <div style={{ height: "20px", width: "5px", top: 2, left: -1, position: "absolute", alignItems: "end" }}>
      <input
        data-node-prefix={treeNode.object.id}
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
              tree.setFocusedNode(treeNode.id, "start");
              break;
            case "ArrowDown":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              tree.moveEditorSelectionDown("start");
              break;
            case "ArrowUp":
            case "ArrowLeft":
              e.preventDefault();
              tree.moveEditorSelectionUp("end");
              break;
            case "Backspace":
              try {
                e.preventDefault();
                await handleBackspaceKey(e.nativeEvent);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unknown error");
              }
              break;
            default:
              if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && !e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                openRelComboBox();
              }
              break;
          }
        }}
        ref={inputRef}
        type="text"
        // onBlur={(e) => {
        //   const node = document.getElementById(treeNode.id + "-noteContent");
        //   if (node) {
        //     node.style.removeProperty("background-color");
        //     setClickedBckspc(false);
        //   }
        // }}
        onChange={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        value=""
      />
    </div>
  );
});
