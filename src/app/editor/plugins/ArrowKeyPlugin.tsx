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
import { $getCaretPosition } from "@/app/editor/utils/selection";
import { isMoveDownHotkey, isMoveUpHotKey } from "@/app/hotkeys";

/**
 * Plugin to jump focus to other editors using arrow keys
 * while selection is in the editor.
 *
 * Arrow handling while in node selection is handled by useOutlineHotkeys.
 */
export const ArrowKeyPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const tree = treeNode.tree;
  const editMode =
    tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id && !!tree.selection.editMode;
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (isMoveUpHotKey(event)) {
            const element = editor.getRootElement();
            if (!element) return false;
            const caretPosition = $getCaretPosition();
            if (!caretPosition) return false;
            if (caretPosition.isAtTop) {
              event.preventDefault();
              tree.moveEditorSelectionUp("end");
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (isMoveDownHotkey(event)) {
            const element = editor.getRootElement();
            if (!element) return false;
            const caretPosition = $getCaretPosition();
            if (!caretPosition) return false;
            if (caretPosition.isAtBottom) {
              event.preventDefault();
              tree.moveEditorSelectionDown("start");
              return true;
            }
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

          // Check if we're in the first node of note content
          const isFirstNoteContentNode =
            treeNode.parentGroup.id === "noteContent" && treeNode.parentGroup.nodes[0] === treeNode;
          if (isFirstNoteContentNode) {
            event.preventDefault();
            // Focus the note content prefix
            const prefixInput = document.querySelector(`[data-note-prefix="${treeNode.parent?.object.id}"]`);
            if (prefixInput instanceof HTMLElement) {
              prefixInput.focus();
              return true;
            }
          }

          // If the previous node is note content, focus on the suffix
          const prevNode = treeNode.siblingAbove;
          if (prevNode !== null && prevNode.childrenGroupsById["noteContent"].nodes.length > 0) {
            event.preventDefault();
            const suffixInput = document.querySelector(`[data-note-suffix="${prevNode.object.id}"]`);
            if (suffixInput instanceof HTMLElement) {
              suffixInput.focus();
              return true;
            }
          }

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

          const siblingBelowNoteContent = treeNode.siblingBelow?.childrenGroupsById["noteContent"].nodes.length;

          // If we are in the last node of a multiline note, go into the suffix
          if (treeNode.parentGroup.id === "noteContent" && treeNode === treeNode.parentGroup.nodes[-1]) {
            const suffixInput = document.querySelector(`[data-note-suffix="${treeNode.parent.object.id}"]`);
            if (suffixInput && suffixInput instanceof HTMLInputElement) {
              suffixInput.focus();
              return true;
            } else {
              throw new Error("Suffix note input not found");
            }
          } else if (siblingBelowNoteContent && siblingBelowNoteContent > 0) {
            const prefixInput = document.querySelector(`[data-note-prefix="${treeNode.siblingBelow.object.id}"]`);
            if (prefixInput instanceof HTMLElement) {
              prefixInput.focus();
              return true;
            } else {
              throw new Error("Prefix note input not found");
            }
          } else if (editMode) {
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
  }, [editor, editMode, tree, treeNode]);

  return null;
};
