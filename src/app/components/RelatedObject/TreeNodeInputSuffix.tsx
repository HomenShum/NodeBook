import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { KeyboardEvent, useEffect, useRef } from "react";

import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { EditorSelectionAction } from "@/app/tree/selection";
import { useTree } from "@/app/tree/TreeContext";

type TreeNodeInputSuffixProps = {
  treeNode: DescendantTreeNode;
};

const useTreeNodeInputHandlers = (treeNode: DescendantTreeNode) => {
  const tree = useTree();
  const graph = useGraphStore();

  const handleFocus = () => tree.setFocusedNode(treeNode.path);

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        const path = await treeNode.parent.createChild({ after: treeNode });
        tree.setFocusedNode(path);
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
        tree.moveEditorSelectionDown("start");
        break;
      case "ArrowLeft":
        e.preventDefault();
        tree.moveEditorSelectionUp("end");
        break;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      tree.selectBetweenShiftClick(treeNode.path, EditorSelectionAction.ClickedOnSuffixInput);
    } else {
      tree.setFocusedNode(treeNode.path);
    }
  };

  return { handleFocus, handleKeyDown, handleClick };
};

export const TreeNodeInputSuffix = observer(({ treeNode }: TreeNodeInputSuffixProps) => {
  const tree = useTree();
  const inputRef = useRef<HTMLInputElement>(null);
  const { handleFocus, handleKeyDown, handleClick } = useTreeNodeInputHandlers(treeNode);

  useEffect(() => {
    return autorun(() => {
      if (tree.isNodeFocused(treeNode.id)) {
        inputRef.current?.focus();
      } else if (tree.selection?.type === "node" && inputRef.current?.contains(document.activeElement)) {
        inputRef.current?.blur();
      }
    });
  }, [tree, treeNode.id]);

  return (
    <input
      style={{ display: "flex", background: "none", border: "none", outline: "none" }}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      ref={inputRef}
      type="text"
      value=""
      onChange={() => {}}
    />
  );
});
