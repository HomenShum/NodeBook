import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, COMMAND_PRIORITY_LOW, KEY_SPACE_COMMAND } from "lexical";
import { useEffect } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";

/**
 * Ignore space at the start of the editor.
 *
 */
export const IgnoreSpaceAtStartOfLabelledRelationsPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { isChild } = useRelationAtPath();
  useEffect(() => {
    if (isChild) return;
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
  }, [editor, isChild]);
  return null;
};
