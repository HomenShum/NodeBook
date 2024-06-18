import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewType } from "@/app/components/RelatedObject/ViewTypeContext";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";

/**
 * Plugin to exit temporary edit mode when user presses Enter or Escape key.
 */
export const ExitTempEditPlugin = () => {
  const graphStore = useGraphStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const { pathToNodeStr } = useRelationAtPath();
  const { setViewType, viewType } = useViewType();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        action((event) => {
          if (!event || !graphStore) return false;
          if (viewType !== "temp-edit") return false;

          event.preventDefault();
          setViewType("edit");
          renderController.setFocusedNode(pathToNodeStr);
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
            renderController.setFocusedNode(pathToNodeStr);
            return true;
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, graphStore, pathToNodeStr, setViewType, renderController, viewType]);

  return null;
};
