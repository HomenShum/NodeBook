import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getRoot, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND, LexicalEditor } from "lexical";
import { action, autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/tree/TreeContext";

function isFocused(editor: LexicalEditor) {
  return editor.getRootElement()?.contains(document.activeElement);
}

export const BindFocusToTreePlugin = observer(() => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();

  // Track the editor's editable state
  const [isEditable, setEditable] = useState(editor.isEditable());
  useEffect(() => {
    setEditable(editor.isEditable());
    return editor.registerEditableListener((currentIsEditable) => {
      setEditable(currentIsEditable);
    });
  }, [editor]);

  // Track the tree's selection
  const [selection, setSelection] = useState(tree.selection);
  useEffect(() => {
    return autorun(() => {
      setSelection(tree.selection ? { ...tree.selection } : null);
    });
  }, [tree]);

  // Set the editor focus and selection to match the tree's selection
  useEffect(() => {
    if (isEditable && !isFocused(editor) && selection?.type === "editor" && selection.treeNodeId === treeNode.id) {
      // Editor isn't focused but should be -> focus it
      editor.update(
        () => {
          if (selection.position === "start") {
            $getRoot().selectStart();
          } else if (selection.position === "end") {
            $getRoot().selectEnd();
          }
        },
        { discrete: true }, // run this update synchronously
      );
      editor.focus();
    }
  }, [editor, tree, treeNode.id, isEditable, selection]);

  useEffect(() => {
    return mergeRegister(
      // When the editor is becoming focused but node isn't focused -> set tree selection to this node
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          if (!tree.isNodeFocused(treeNode.id)) {
            tree.setFocusedNode(treeNode.id);
            return true;
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, tree, treeNode.id]);

  return null;
});
