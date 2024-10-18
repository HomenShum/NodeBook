import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { GraphNode } from "@/app/graph/GraphNode";

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
  const tree = useTree();
  const inputRef = useRef<HTMLInputElement>(null);

  // Only grab selection if  tree node
  const treeNodeShouldHaveFocus = tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id;
  useEffect(() => {
    if (!isEditorEditable) {
      const inputFocused = inputRef.current?.contains(document.activeElement);
      if (!inputFocused && treeNodeShouldHaveFocus) {
        inputRef.current?.focus();
      } else if (inputFocused && !treeNodeShouldHaveFocus) {
        inputRef.current?.blur();
      }
    }
  }, [treeNodeShouldHaveFocus, isEditorEditable]);

  return (
    <input
      style={{
        maxWidth: 1,
        padding: 0,
      }}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      onKeyDown={async (e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            await tree.split(treeNode, {
              before: [],
              after: (treeNode.object && treeNode.object instanceof GraphNode && treeNode.object.content) || [],
            });
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
            const inputSuffix = inputRef.current?.nextElementSibling?.nextElementSibling;
            if (inputSuffix) {
              (inputSuffix as HTMLElement).focus();
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            tree.moveEditorSelectionUp("end");
            break;
          case "Tab":
            e.preventDefault();
            tree.indentSelection();
            break;
          default:
            e.preventDefault();
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
      onChange={() => {}}
    />
  );
});
