import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND, KEY_TAB_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/view/TreeContext";
/**
 * Plugin to move current node using Tab/Shift+Tab. Also handles bulleting by typing '-' at the start of a line.
 */
export const TabAndBulletPlugin = () => {
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();

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
            tree.indentNode(treeNode);
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        action((event: KeyboardEvent) => {
          event.preventDefault();
          return event.shiftKey ? !!tree.dedentNode(treeNode) : !!tree.indentNode(treeNode);
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [tree, editor, treeNode]);

  return null;
};
