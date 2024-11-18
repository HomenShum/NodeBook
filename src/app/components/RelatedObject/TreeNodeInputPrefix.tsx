import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

type Props = {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
};

/**
 * Renders an invisible input at the start of a tree node, allowing user
 * interaction with non-editable content. This allows the user to still focus
 * the node and enabling actions like splitting nodes.
 *
 * When isEditorEditable is false, it becomes responsible for grabbing the
 * selection in response to tree selection changes.
 */
export const TreeNodeInputPrefix = observer(function TreeNodeInputSuffix({ treeNode, isEditorEditable }: Props) {
  const tree = treeNode.tree;
  const graphStore = useGraphStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Only grab selection if  tree node
  const treeNodeShouldHaveFocus = tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id;
  const isStartPosition = tree.selection?.type === "editor" && tree.selection.position === "start";
  useEffect(() => {
    if (!isEditorEditable) {
      const inputFocused = inputRef.current?.contains(document.activeElement);
      if (!inputFocused && treeNodeShouldHaveFocus && isStartPosition) {
        inputRef.current?.focus();
      } else if (inputFocused && !treeNodeShouldHaveFocus) {
        inputRef.current?.blur();
      }
    }
  }, [treeNodeShouldHaveFocus, isEditorEditable, isStartPosition]);

  return (
    <input
      style={{
        maxWidth: 8,
        backgroundColor: "transparent",
        padding: 0,
        border: 0,
        outline: "none",
        marginLeft: -2,
        position: "absolute",
        zIndex: 1,
        cursor: "text",
        pointerEvents: "all",
      }}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}

      //Todo: Can this be replaced with hotkeys?
      onKeyDown={async (e: React.KeyboardEvent) => {
        const isMod = e.metaKey || e.ctrlKey;
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            if (e.shiftKey) {
              await tree.convertToNote(treeNode);
            } else {
              await tree.split(treeNode, {
                before: [],
                after: (treeNode.object && treeNode.object instanceof GraphNode && treeNode.object.content) || [],
              });
            }
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
            e.preventDefault();
            tree.setFocusedNode(treeNode.id, "end");
            break;
          case "ArrowLeft":
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (isMod && e.shiftKey) {
              tree.moveSelectedNodesUp();
              break;
            }
            e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("end");
            break;
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (isMod && e.shiftKey) {
              tree.moveSelectedNodesDown();
              break;
            }
            e.metaKey || e.ctrlKey ? tree.expandAtSelection() : tree.moveEditorSelectionDown("start");
            break;
          case "Tab":
            e.preventDefault();
            tree.indentSelection();
            break;
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
        e.currentTarget.focus();
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
              content: [{ type: "text", value: content }, ...treeNode.object.content],
            },
          });
          tree.setFocusedNode(treeNode.path, { anchorOffset: content.length, focusOffset: content.length }, true);
        }
      }}
    />
  );
});
