import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND, KEY_TAB_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/view/TreeContext";
/**
 * Plugin to move current node using Tab/Shift+Tab. Also handles bulleting by typing '-' at the start of a line.
 */
export const TabAndBulletPlugin = () => {
  const renderController = useRenderController();
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();

  const indentAndFocus = useCallback(() => {
    const path = tree.indentNode(treeNode);
    if (!path) return false;
    renderController.setFocusedNode(path);
    return true;
  }, [renderController, tree, treeNode]);

  const dedentAndFocus = useCallback(() => {
    const path = tree.dedentNode(treeNode);
    if (!path) return false;
    renderController.setFocusedNode(path);
    return true;
  }, [renderController, tree, treeNode]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key === "-") {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const startEnd = selection.getStartEndPoints();
            if (!startEnd) return false;
            const [selectionStart, selectionEnd] = startEnd;

            // Offset is 0 when at start of text
            if (selectionStart.offset !== 0 || selectionEnd.offset !== 0) return false;
            if (!treeNode.siblingAbove) return false;
            indentAndFocus();
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        action((event: KeyboardEvent) => {
          event.preventDefault();
          return event.shiftKey ? dedentAndFocus() : indentAndFocus();
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, treeNode, tree.rootObject.id, indentAndFocus, dedentAndFocus]);

  return null;
};
