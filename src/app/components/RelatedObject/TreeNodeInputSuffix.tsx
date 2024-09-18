import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { EditorSelectionAction } from "@/app/tree/selection";
import { useTree } from "@/app/tree/TreeContext";

type TreeNodeInputSuffixProps = {
  treeNode: DescendantTreeNode;
};

export const TreeNodeInputSuffix = observer(({ treeNode }: TreeNodeInputSuffixProps) => {
  const tree = useTree();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update the input focus according to the tree selection state
  const shouldBeFocused =
    tree.selection?.type === "editor" &&
    tree.selection.treeNodeId === treeNode.id &&
    treeNode.object.isGlobal &&
    !tree.selection.editMode;
  const shouldntBeFocused = tree.selection?.type === "node";
  useEffect(() => {
    const inputFocused = inputRef.current?.contains(document.activeElement);
    if (!inputFocused && shouldBeFocused) {
      inputRef.current?.focus();
    } else if (inputFocused && shouldntBeFocused) {
      inputRef.current?.blur();
    }
  }, [shouldBeFocused, shouldntBeFocused]);

  return (
    <input
      style={{ display: "flex", background: "none", border: "none", outline: "none" }}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      onKeyDown={async (e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            const path = await treeNode.parent.createChild({ after: treeNode });
            tree.setFocusedNode(path, "start", undefined, true);
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
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          tree.selectBetweenShiftClick(treeNode.path, EditorSelectionAction.ClickedOnSuffixInput);
        } else {
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
