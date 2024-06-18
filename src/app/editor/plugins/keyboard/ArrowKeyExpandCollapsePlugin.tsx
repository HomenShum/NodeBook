import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/view/Outline";

/**
 * Plugin to expand/collapse current node using Cmd + ArrowDown/ArrowUp.
 */
export const ArrowKeyExpandCollapsePlugin = () => {
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { pathToNodeStr } = useRelationAtPath();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (metaOrCtrl && !event.shiftKey && event.key === "ArrowDown") {
          event.preventDefault();
          tree.setPathExpanded(pathToNodeStr, true);
          return true;
        } else if (metaOrCtrl && !event.shiftKey && event.key === "ArrowUp") {
          event.preventDefault();
          tree.setPathExpanded(pathToNodeStr, false);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, tree, pathToNodeStr]);

  return null;
};
