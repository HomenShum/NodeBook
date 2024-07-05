import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTree } from "@/app/tree/TreeContext";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const CreateNodeAtTopPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key === "k" && event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          tree.createChildNodeAndFocus();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [tree, editor]);
  return null;
};
