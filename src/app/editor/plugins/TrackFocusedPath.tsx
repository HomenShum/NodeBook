import { useViewController } from "@/app/controller/useViewController";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_LOW, FOCUS_COMMAND } from "lexical";
import { useEffect } from "react";

export const TrackFocusedPath = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          viewController.trackFocusedNode(null);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          viewController.trackFocusedNode(pathToNodeStr);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [pathToNodeStr, editor, viewController]);
  return null;
};
