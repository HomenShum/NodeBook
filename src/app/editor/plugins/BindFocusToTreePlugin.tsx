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

  useEffect(() => {
    // Update the editor focus to match the tree selection
    return autorun(() => {
      const sel = tree.selection;
      if (sel === null) {
        if (isFocused(editor)) {
          editor.blur();
        }
        return;
      }
      switch (sel.type) {
        case "node": {
          if (isFocused(editor)) {
            // When the selection switches to node type, blur all editors
            editor.blur();
          }
          break;
        }
        case "editor": {
          if (!isFocused(editor) && sel.treeNodeId === treeNode.id) {
            // Editor isn't focused but should be -> focus it
            editor.update(
              () => {
                if (sel.position === "start") {
                  $getRoot().selectStart();
                } else if (sel.position === "end") {
                  $getRoot().selectEnd();
                }
              },
              { discrete: true }, // run this update synchronously
            );
            editor.focus();
          } else if (isFocused(editor) && sel.treeNodeId !== treeNode.id) {
            // Editor is focused but shouldn't be -> blur it
            editor.blur();
          }
        }
      }
    });
  }, [editor, isEditable, tree, treeNode.id]);

  useEffect(() => {
    // Update the tree selection to match the editor focus
    return mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          if (!tree.isNodeFocused(treeNode.id)) {
            // Editor is becoming focused but node isn't focused -> set tree selection to this node
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
