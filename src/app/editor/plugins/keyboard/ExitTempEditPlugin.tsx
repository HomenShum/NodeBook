import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

/**
 * Plugin to exit temporary edit mode when user presses Enter or Escape key.
 */
export const ExitTempEditPlugin = () => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const { pathToNodeStr, viewType, setViewType } = useRelationAtPath();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        action((event) => {
          if (!event || !graphStore) return false;
          if (viewType !== "temp-edit") return false;

          event.preventDefault();
          setViewType("edit");
          viewController.setFocusedNode(pathToNodeStr);
          return true;
        }),
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        action((event) => {
          if (viewType === "temp-edit") {
            event.preventDefault();
            setViewType("edit");
            viewController.setFocusedNode(pathToNodeStr);
            return true;
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, graphStore, pathToNodeStr, setViewType, viewController, viewType]);

  return null;
};
