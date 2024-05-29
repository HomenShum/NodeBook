import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
import { useEffect } from "react";

import { useViewController } from "@/app/controller/useViewController";

export const TrackFocusedPathPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          viewController.trackFocusedNode(null);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          viewController.trackFocusedNode(pathToNodeStr);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [pathToNodeStr, editor, viewController]);
  return null;
};
