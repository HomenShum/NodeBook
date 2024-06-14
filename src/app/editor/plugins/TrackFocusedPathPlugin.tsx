import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRenderController } from "@/app/render/useRenderController";

export const TrackFocusedPathPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          renderController.trackFocusedNode(null);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          renderController.trackFocusedNode(pathToNodeStr);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [pathToNodeStr, editor, renderController]);
  return null;
};
