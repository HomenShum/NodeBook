import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/model/useGraphStore";

/**
 * Plugin to expand/collapse current node using Cmd + ArrowDown/ArrowUp.
 */
export const ArrowKeyExpandCollapsePlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { pathToNodeStr } = useRelationAtPath();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (metaOrCtrl && !event.shiftKey && event.key === "ArrowDown") {
          event.preventDefault();
          graphStore.setPathExpanded(pathToNodeStr, true);
          return true;
        } else if (metaOrCtrl && !event.shiftKey && event.key === "ArrowUp") {
          event.preventDefault();
          graphStore.setPathExpanded(pathToNodeStr, false);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, graphStore, pathToNodeStr]);

  return null;
};
