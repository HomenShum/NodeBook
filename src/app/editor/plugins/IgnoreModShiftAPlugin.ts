import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

/**
 * Prevents the "a" key from being used to select all text in the editor
 * when shift and meta/ctrl are pressed. We do this because it's a shortcut
 * in chrome for searching tabs.
 */
export const IgnoreModShiftAPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key === "a" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
};
