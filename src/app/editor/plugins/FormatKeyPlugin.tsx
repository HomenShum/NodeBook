import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, FORMAT_TEXT_COMMAND, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

export const FormatKeyPlugin = () => {
  const [editor] = useLexicalComposerContext();

  // Bold shortcut
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) return false;
        if (event.metaKey && event.key === "b") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  // Italic shortcut
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) return false;
        if (event.metaKey && event.key === "i") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
};
