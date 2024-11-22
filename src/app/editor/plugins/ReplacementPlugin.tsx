import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  ElementNode,
  KEY_DOWN_COMMAND,
  ParagraphNode,
  TextNode,
} from "lexical";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { nodeToChip } from "@/app/editor/utils/content";
import { $getTextAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { BaseTreeNode, DescendantTreeNode } from "@/app/tree/nodes";
import { HASHTAG_SYMBOL, MENTION_SYMBOL } from "@/lib/utils";

const AT_HASH = MENTION_SYMBOL + HASHTAG_SYMBOL;

interface Props {
  // Explicit `null` because not passing it where needed would result in bugs
  treeNode: BaseTreeNode | null;
}

export const ReplacementPlugin = ({ treeNode }: Props) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== HASHTAG_SYMBOL || !settingsStore.atHashtagReplacement) return false;
        if (!(treeNode instanceof DescendantTreeNode) || !(treeNode.object instanceof GraphNode)) return false;

        // We need to have a selection, inside a single node, with no text before it.
        // Otherwise exit early
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        if (selection.anchor.key !== selection.focus.key) return false;
        const { beforeText } = $getTextAroundSelection();
        if (beforeText.match(/\S$/)) return false;

        event.preventDefault();

        // Create contents with just # inserted and then with @# inserted. We
        // dispatch two updates so the user can press undo to go back to just #.
        const withHashContents: Chip[] = [];
        const withAtHashContents: Chip[] = [];
        let node: TextNode | ElementNode | null = selection.anchor.getNode();
        if (node instanceof ParagraphNode && node.getChildrenSize() === 0) {
          // Empty paragraph, just replace it with a hashtag
          withHashContents.push({ type: "text", value: HASHTAG_SYMBOL });
          withAtHashContents.push({ type: "text", value: AT_HASH });
        } else if (node instanceof TextNode) {
          // Selection is inside a text node, insert the hashtag into it
          const text = node.getTextContent();
          const [start, end] = [selection.anchor.offset, selection.focus.offset].sort((a, b) => a - b);
          const textBefore = text.slice(0, start);
          const textAfter = text.slice(end);
          const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
          paragraph.getChildren().forEach((n) => {
            if (n === node) {
              withHashContents.push({ type: "text", value: textBefore + HASHTAG_SYMBOL + textAfter });
              withAtHashContents.push({ type: "text", value: textBefore + AT_HASH + textAfter });
            } else {
              withHashContents.push(nodeToChip(n));
              withAtHashContents.push(nodeToChip(n));
            }
          });
        } else {
          return false;
        }

        // Update the graph node with the new contents
        const treeNodeId = treeNode.id;
        const graphNode = treeNode.object;
        graphStore
          .updateNode({ nodeId: graphNode.id, nodeProps: { content: withHashContents } })
          .then(() => {
            graphStore.updateNode({ nodeId: graphNode.id, nodeProps: { content: withAtHashContents } });
          })
          .then(() => {
            // Move the cursor to the end of the hashtag
            const sel = treeNode.tree.selection;
            if (sel?.type !== "editor") return;
            if (sel.position === "start" || sel.position === "end") return;
            const newOffset = Math.min(sel.position.anchorOffset, sel.position.focusOffset) + 1;
            treeNode.tree.setFocusedNode(treeNodeId, { anchorOffset: newOffset, focusOffset: newOffset });
          });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, settingsStore.atHashtagReplacement, treeNode]);

  return null;
};
