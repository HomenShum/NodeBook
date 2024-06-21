import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, COMMAND_PRIORITY_LOW, KEY_SPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { isUnlabelledChild } from "@/app/view/Tree";

/**
 * Ignore space at the start of the editor.
 *
 */
export const IgnoreSpaceAtStartOfLabelledRelationsPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  useEffect(() => {
    if (isUnlabelledChild(treeNode)) return;
    return editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event) => {
        const text = $getRoot().getTextContent();
        if (text.trim() === "") {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, treeNode]);
  return null;
};
