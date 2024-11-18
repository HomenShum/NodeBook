import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_ESCAPE_COMMAND } from "lexical";
import { useEffect } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

export const ToggleEditablePlugin = ({ treeNode, editable }: { treeNode: DescendantTreeNode; editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;

  // toggle editor editable
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  // disable editor when escape is pressed
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (e) => {
        if (tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id && tree.selection.editMode) {
          e.preventDefault();
          e.stopPropagation();
          tree.setFocusedNode(treeNode.id, "start", false);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, treeNode, tree]);

  return null;
};
