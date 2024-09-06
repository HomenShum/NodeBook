import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

export const ToggleEditablePlugin = ({ treeNode, editable }: { treeNode: DescendantTreeNode; editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();

  // toggle editor editable
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  // disable editor when escape is pressed
  useEffect(() => {
    return editor.registerCommand(
      // We were using KEY_ESCAPE_COMMAND, but it wasn't firing on the first escape press
      // for some reason. KEY_DOWN_COMMAND does.
      KEY_DOWN_COMMAND,
      (e) => {
        if (
          e.key === "Escape" &&
          tree.selection?.type === "editor" &&
          tree.selection.treeNodeId === treeNode.id &&
          tree.selection.editMode
        ) {
          e.preventDefault();
          e.stopPropagation();
          tree.setFocusedNode(treeNode.id, "start", undefined, false);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, treeNode, tree]);

  return null;
};
