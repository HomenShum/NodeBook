import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from "lexical";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

export const SelectAllPlugin = observer(() => {
  const [editor] = useLexicalComposerContext();
  const lastCmdATime = useRef<number | null>(null);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key === "a" && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
          const now = Date.now();

          // If this is a second Cmd+A within 1000ms
          if (lastCmdATime.current && now - lastCmdATime.current < 1000) {
            event.preventDefault();

            // Dispatch a custom event that will be handled by a listener in the tree
            const customEvent = new CustomEvent("doubleCommandA", {
              bubbles: true,
              cancelable: true,
              detail: { editorElement: editor.getRootElement() },
            });

            // We need to dispatch the event at the document level to ensure it reaches the OutlineContent component
            document.dispatchEvent(customEvent);

            lastCmdATime.current = null; // Reset the timer
            return true;
          }

          // First Cmd+A, let it proceed normally but record the time
          lastCmdATime.current = now;
          return false;
        }

        // Reset the timer if any other key is pressed
        if (event.key !== "Meta" && event.key !== "Control") {
          lastCmdATime.current = null;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
});
