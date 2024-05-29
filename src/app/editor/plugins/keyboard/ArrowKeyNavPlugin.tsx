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
import { relationsToPathStr } from "@/app/util";

/**
 * Plugin to jump focus to other editors using arrow keys.
 */
export const ArrowKeyNavPlugin = () => {
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const { pathToParentRelations, siblingAbove, siblingBelow } = useRelationAtPath();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!siblingBelow) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingBelow]));
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!siblingAbove) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
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
          if (!siblingAbove) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]), {
            focusAt: "end",
          });
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
          if (!siblingBelow) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingBelow]), {
            focusAt: "start",
          });
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, pathToParentRelations, siblingAbove, siblingBelow, viewController]);

  return null;
};
