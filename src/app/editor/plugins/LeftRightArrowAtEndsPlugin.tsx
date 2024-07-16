import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { useTree } from "@/app/tree/TreeContext";

/**
 * Plugin to jump focus to other editors using left and right arrow keys
 * when at the start or end of the editor.
 */
export const LeftRightArrowAtEndsPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          const selectionStart = $getSelection()?.getStartEndPoints()?.[0];
          // Offset is 0 when at start of text
          if (!selectionStart || selectionStart.offset !== 0) return false;
          const focusedMoved = tree.moveEditorSelectionUp();
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
          const focusedMoved = tree.moveEditorSelectionDown();
          if (!focusedMoved) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, tree]);

  return null;
};
