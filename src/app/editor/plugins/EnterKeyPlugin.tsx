import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { GraphNode } from "@/app/graph/GraphNode";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { isNoteContent } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "EnterKeyPlugin" });

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const viewStore = useViewStore();

  const viewType = viewStore.viewType;
  useEffect(() => {
    function handleSplit(event: KeyboardEvent) {
      const selection = $getSelection();
      if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
      if (!(treeNode.object instanceof GraphNode)) {
        // For now, we don't support splitting relations. In ENT-3653, we'll
        // decide if and how to support this.
        logger.warn("Splitting relations is not supported yet.");
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
      tree.split(treeNode, { before: chipsBefore, after: chipsAfter });
      return true;
    }

    function handleConvertToNote(event: KeyboardEvent) {
      if (!(treeNode.object instanceof GraphNode)) {
        logger.warn("Only nodes can be converted to note right now");
        return false;
      }
      event.preventDefault();
      event.stopPropagation();

      tree.convertToNote(treeNode);
      return true;
    }

    function handleSplitNote(event: KeyboardEvent) {
      const selection = $getSelection();
      if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
      if (!(treeNode instanceof DescendantTreeNode)) return false;
      event.preventDefault();
      event.stopPropagation();
      const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
      tree.splitNote(treeNode, { before: chipsBefore, after: chipsAfter });
      return true;
    }

    const childOfTreeRoot = treeNode.parent instanceof RootTreeNode;
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event || !graphStore) return false;
        if (event.metaKey || event.ctrlKey) {
          if (isNoteContent(treeNode)) {
            return handleSplitNote(event);
          } else {
            return handleSplit(event);
          }
        }
        if (!isNoteContent(treeNode) && ((viewType === "note" && childOfTreeRoot) || event.shiftKey)) {
          return handleConvertToNote(event);
        } else {
          return handleSplit(event);
        }
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, tree, treeNode, viewType]);

  return null;
};
