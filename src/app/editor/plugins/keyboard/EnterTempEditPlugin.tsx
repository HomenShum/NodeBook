import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewType } from "@/app/components/RelatedObject/ViewTypeContext";
import { useGraphStore } from "@/app/graph/useGraphStore";

/**
 * Plugin to enter temporary edit mode when user presses Alt + Shift + R.
 */
export const EnterTempEditPlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { object } = useRelationAtPath();
  const { setViewType } = useViewType();

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
