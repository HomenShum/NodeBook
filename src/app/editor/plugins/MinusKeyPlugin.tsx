import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { DescendantTreeNode, TreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { isNoteContent } from "@/app/tree/utils";

export const MinusKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();

  useEffect(() => {
    function handleInlineSplitNote(event: KeyboardEvent) {
      if (!(treeNode instanceof DescendantTreeNode)) return false;
      event.preventDefault();
      event.stopPropagation();
      tree.splitNote(treeNode, { before: [], after: [] }, true);
      return true;
    }
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key === "-") {
            editor.update(() => {
              if (isNoteContent(treeNode) && treeNode.object.text === "--") {
                handleInlineSplitNote(event);
              }
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [editor, treeNode, tree]);

  return null;
};
