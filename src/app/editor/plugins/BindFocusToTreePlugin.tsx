import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getRoot, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
import { action, autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/tree/TreeContext";

export const BindFocusToTreePlugin = observer(() => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();

  useEffect(() => {
    function isEditorFocused() {
      return editor.getRootElement()?.contains(document.activeElement);
    }

    // Update the editor focus to match the tree selection
    const disposeAutorun = autorun(() => {
      const sel = tree.selection;
      if (sel === null) {
        if (isEditorFocused()) {
          editor.blur();
        }
        return;
      }
      switch (sel.type) {
        case "node": {
          if (isEditorFocused()) {
            // When the selection switches to node type, blur all editors
            editor.blur();
          }
          break;
        }
        case "editor": {
          if (!isEditorFocused() && sel.treeNodeId === treeNode.id) {
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
          } else if (isEditorFocused() && sel.treeNodeId !== treeNode.id) {
            // Editor is focused but shouldn't be -> blur it
            editor.blur();
          }
        }
      }
    });

    // Update the tree selection to match the editor focus
    const disposeCommands = mergeRegister(
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
    return () => {
      disposeAutorun();
      disposeCommands();
    };
  }, [editor, tree, treeNode.id]);

  return null;
});
