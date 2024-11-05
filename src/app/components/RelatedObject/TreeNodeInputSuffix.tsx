import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

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
export const TreeNodeInputSuffix = observer(function TreeNodeInputSuffix({ treeNode, isEditorEditable }: Props) {
  const tree = useTree();
  const inputRef = useRef<HTMLInputElement>(null);
  const graphStore = useGraphStore();

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
    <input
      className={styles.RelatedObjectInputSuffix}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      onKeyDown={async (e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            await tree.split(treeNode);
            break;
          case "Backspace":
            if (!treeNode.object.isLocal) {
              try {
                e.preventDefault();
                await tree.replaceObjectAtNodeWithCopy(treeNode.id);
                tree.setFocusedNode(treeNode.id);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unknown error");
              }
            }
            break;
          case "ArrowRight":
          case "ArrowDown":
            e.preventDefault();
            tree.moveEditorSelectionDown("start");
            break;
          case "ArrowUp":
            e.preventDefault();
            tree.moveEditorSelectionUp("end");
            break;
          case "ArrowLeft":
            e.preventDefault();
            tree.setFocusedNode(treeNode.id, "start");
            break;
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      ref={inputRef}
      type="text"
      value=""
      onChange={async (e) => {
        // When a user types in the input, apply the content to the end of the
        // node and then switch back into edit mode.
        // Requested in https://ideaflowteam.slack.com/archives/C07FU15QKTP/p1729288027846699
        if (treeNode.object instanceof GraphNode) {
          e.preventDefault();
          e.stopPropagation();
          const content = e.target.value;
          await graphStore.updateNode({
            nodeId: treeNode.object.id,
            nodeProps: {
              content: [...treeNode.object.content, { type: "text", value: content }],
            },
          });
          tree.setFocusedNode(treeNode.path, "end", true);
        }
      }}
    />
  );
});
