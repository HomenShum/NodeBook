import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Chip } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { TreeNode } from "@/app/tree/nodes";
import { Tree } from "@/app/tree/Tree";

export function useHandleAtKey(tree: Tree, treeNode: TreeNode) {
  const graphStore = useGraphStore();

  /*
   * Given an index in the text content of a node, return the index of the chip and
   *  the index of the character within the chip.
   */
  function indexToChipPosition(index: number, chips: Chip[]): [number, number] {
    let start = 0;
    for (const [i, chip] of chips.entries()) {
      if (chip.type !== "text") {
        return [-1, -1];
      }
      const end = start + chip.value.length;
      if (index >= start && index <= end) return [i, index - start];
      start = end + 1;
    }
    return [-1, -1];
  }
  return useCallback(
    (e: KeyboardEvent) => {
      // Convert selected chips to a mention
      const treeSelection = tree.selection;
      if (!treeSelection || treeSelection.type !== "editor") return false;
      const posn = treeSelection.position;
      if (posn === "start" || posn === "end" || posn.anchorOffset === posn.focusOffset) return false;

      // Update the text content to have an "@" at the start of the selection
      const node = graphStore.getNode(treeNode.object.id);
      if (!node) return false;
      const lesserPosn = Math.min(posn.anchorOffset, posn.focusOffset);
      const greaterPosn = Math.max(posn.anchorOffset, posn.focusOffset);
      const [chipIndex, valueIndex] = indexToChipPosition(lesserPosn, node.content);
      if (chipIndex === -1) return false;
      const chip = node.content[chipIndex];
      const chipType = chip.type;
      if (chipType !== "text") return false;
      if (chip.value[valueIndex - 1] !== " " && !(valueIndex === 0 && chipIndex === 0)) return false;

      e.preventDefault();
      e.stopPropagation();

      const newValue = chip.value.slice(0, valueIndex) + "@" + chip.value.slice(valueIndex);
      const newContent: Chip[] = [...node.content];
      newContent[chipIndex] = { type: "text", value: newValue };
      const txs: TxCombined = [];
      txs.push({ type: "updateNode", transaction: { nodeId: node.id, nodeProps: { content: newContent } } });
      graphStore.applyCombinedTransaction(txs);
      tree.selection = {
        type: "editor",
        treeNodeId: treeNode.id,
        position: { anchorOffset: greaterPosn + 1, focusOffset: greaterPosn + 1 },
      };
      return true;
    },
    [tree, treeNode, graphStore],
  );
}

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const AtKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;
  const handleAtKey = useHandleAtKey(tree, treeNode);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (event.key !== "@") return false;
        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints() || selection.getNodes().length > 1)
          return false;
        return handleAtKey(event);
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, handleAtKey]);

  return null;
};
