import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

/**
 * Plugin to enter temporary edit mode when user presses Alt + Shift + R.
 */
export const EnterTempEditPlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { object, setViewType } = useRelationAtPath();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (event.altKey && event.shiftKey && (event.key === "r" || event.key === "‰")) {
          // Alt + Shift + R (for some reason, on Taylor's Mac, this is the key combo for ‰)
          if (graphStore.shouldTreatObjectAsLink(object)) {
            event.preventDefault();
            setViewType("temp-edit");
            return true;
          }
        }
        return false;
      }),
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, graphStore, object, setViewType]);

  return null;
};
