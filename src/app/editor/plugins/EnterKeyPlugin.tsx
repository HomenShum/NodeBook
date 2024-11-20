import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
import { DescendantTreeNode, PointerTreeNode, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { Tree } from "@/app/tree/Tree";
import { isNoteContent } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

export function useHandleEnterKey(tree: Tree, treeNode: TreeNode) {
  const { addToast } = useToast();
  const viewType = useViewStore().viewType;
  return useCallback(
    (e: KeyboardEvent, chips?: { before: Chip[]; after: Chip[] }) => {
      if (e.key !== "Enter") return false;
      e.preventDefault();
      e.stopPropagation();
      const isMod = e.metaKey || e.ctrlKey;
      const childOfTreeRoot = treeNode.parent instanceof RootTreeNode;
      if (isMod) {
        if (isNoteContent(treeNode) && treeNode instanceof DescendantTreeNode) {
          tree.splitNote(treeNode, chips);
          return true;
        } else {
          tree.split(treeNode, chips);
          return true;
        }
      }
      if (!isNoteContent(treeNode) && ((viewType === "note" && childOfTreeRoot) || e.shiftKey)) {
        tree.splitIntoNote(treeNode, chips);
        return true;
      } else {
        if (treeNode instanceof PointerTreeNode) {
          addToast({
            title: "Cannot split while sublists are flattened",
          });
          return false;
        }
        tree.split(treeNode, chips);
        return true;
      }
    },
    [tree, treeNode, viewType, addToast],
  );
}

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;
  const handleEnterKey = useHandleEnterKey(tree, treeNode);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event) return false;
        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
        const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
        return handleEnterKey(event, { before: chipsBefore, after: chipsAfter });
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, handleEnterKey]);

  return null;
};
