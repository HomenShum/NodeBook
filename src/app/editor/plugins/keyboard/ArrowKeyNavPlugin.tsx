import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { $getText, getSelectionPositions } from "@/app/editor/utils";

/**
 * Plugin to jump focus to other editors using arrow keys.
 */
export const ArrowKeyNavPlugin = () => {
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const { object, pathToParentRelations, siblingAbove, siblingBelow } = useRelationAtPath();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const [selectionLeft, _] = getSelectionPositions(editor);
          const textAfter = $getText({ from: selectionLeft });
          if (textAfter.includes("\n")) return false;

          const focusedMoved = viewController.focusNextEditor({ focusAt: "start" });
          if (!focusedMoved) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const [selectionLeft, _] = getSelectionPositions(editor);
          const textBefore = $getText({ to: selectionLeft });
          if (textBefore.includes("\n")) return false;

          const focusedMoved = viewController.focusPrevEditor({ focusAt: "end" });
          if (!focusedMoved) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          const selectionStart = $getSelection()?.getStartEndPoints()?.[0];
          // Offset is 0 when at start of text
          if (!selectionStart || selectionStart.offset !== 0) return false;

          const focusedMoved = viewController.focusPrevEditor({ focusAt: "end" });
          if (!focusedMoved) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          const lastNode = $getRoot().getLastDescendant();
          if (
            selection.anchor.key !== lastNode?.getKey() ||
            selection.anchor.offset !== lastNode?.getTextContentSize()
          ) {
            // Selection not at end of editor
            return false;
          }

          const focusedMoved = viewController.focusNextEditor({ focusAt: "start" });
          if (!focusedMoved) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, pathToParentRelations, siblingAbove, siblingBelow, viewController]);

  return null;
};
