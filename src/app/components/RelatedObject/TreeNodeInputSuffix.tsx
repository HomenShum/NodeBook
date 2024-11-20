import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useHandleEnterKey } from "@/app/editor/plugins/EnterKeyPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
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
export const TreeNodeInputSuffix = observer(function TreeNodeInputSuffix({ treeNode, isEditorEditable }: Props) {
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
    <input
      className={styles.RelatedObjectInputSuffix}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      onKeyDown={async (e: React.KeyboardEvent) => {
        const isMod = e.metaKey || e.ctrlKey;
        switch (e.key) {
          case "Enter": {
            return handleEnterKey(e.nativeEvent);
          }
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
            if (isMod && e.shiftKey) {
              console.log("Before moveSelectedNodesUp");
              tree.moveSelectedNodesUp();
              break;
            }
            e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("start");
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
