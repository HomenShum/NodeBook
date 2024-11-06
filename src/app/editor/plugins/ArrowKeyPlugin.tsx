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

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/tree/TreeContext";
import { $getCaretPosition } from "@/app/editor/utils/selection";

/**
 * Plugin to jump focus to other editors using left and right arrow keys
 * when at the start or end of the editor.
 */
export const ArrowKeyPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();
  const editMode =
    tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id && !!tree.selection.editMode;
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const element = editor.getRootElement();
          if (!element) return false;
          const caretPosition = $getCaretPosition();
          if (!caretPosition) return false;
          if (caretPosition.isAtTop) {
            event.preventDefault();
            tree.moveEditorSelectionUp("end");
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const element = editor.getRootElement();
          if (!element) return false;
          const caretPosition = $getCaretPosition();
          if (!caretPosition) return false;
          if (caretPosition.isAtBottom) {
            // const x = $isCaretOnFirstLine();
            event.preventDefault();
            tree.moveEditorSelectionDown("end");
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          const selectionStart = $getSelection()?.getStartEndPoints()?.[0];
          // Offset is 0 when at start of text
          if (!selectionStart || selectionStart.offset !== 0) return false;
          const focusedMoved = tree.moveEditorSelectionUp("end");
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
          if (editMode) {
            // disable edit mode and move selection outside of editor
            tree.setFocusedNode(treeNode.id, "end", false);
          } else {
            // move down
            const focusedMoved = tree.moveEditorSelectionDown("start");
            if (!focusedMoved) return false;
          }
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, editMode, tree, treeNode.id]);

  return null;
};
