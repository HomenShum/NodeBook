import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
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
    // Update the editor focus to match the tree selection
    const disposeAutorun = autorun(() => {
      if (tree.isNodeFocused(treeNode.id)) {
        editor.focus();
      } else if (tree.selection?.type === "node" && editor.getRootElement()?.contains(document.activeElement)) {
        editor.blur();
      }
    });

    // Update the tree selection to match the editor focus
    const disposeCommands = mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        action(() => {
          if (tree.isNodeFocused(treeNode.id)) {
            tree.setFocusedNode(null);
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          tree.setFocusedNode(treeNode.id);
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
