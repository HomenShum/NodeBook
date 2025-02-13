import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
  ParagraphNode,
} from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $createParagraphMatchingGraphNode, graphNodeMatchesParagraph } from "@/app/editor/utils/content";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { TreeNode } from "@/app/tree/nodes";
import { uuid } from "@/app/util";
import { HASHTAG_SYMBOL } from "@/lib/utils";

/**
 * Plugin to handle hashtag nodes
 */
export const HashtagPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (!event) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const { chipsBefore } = $getChipsAroundSelection(selection);
        const previousChip = chipsBefore[chipsBefore.length - 1];

        if (event.key === HASHTAG_SYMBOL) {
          // Handle new hashtag creation
          event.preventDefault();

          const newNodeId = uuid();
          graphStore.addChildNode({
            parentId: graphStore.myHashtagsNodeId,
            nodeProps: { id: newNodeId, content: "#" },
            after: -1,
          });

          $createMentionNode(newNodeId, "#", HASHTAG_SYMBOL);

          const { chipsAfter } = $getChipsAroundSelection(selection);
          const newContent: Chip[] = [
            ...chipsBefore,
            { type: "mention", value: newNodeId, mentionTrigger: HASHTAG_SYMBOL },
            ...chipsAfter,
          ];

          updateEditorContent(newContent);
          return true;
        } else if (
          !event.ctrlKey &&
          !event.metaKey &&
          event.key.length === 1 &&
          /[a-zA-Z0-9*()[\]{}|\\/<>,.!@#$%^&+=;:'"`~?-]/.test(event.key) &&
          previousChip?.type === "mention" &&
          previousChip.mentionTrigger === HASHTAG_SYMBOL
        ) {
          // Handle typing after a hashtag - update the hashtag node's content
          event.preventDefault();

          const hashtagNodeId = previousChip.value;
          const existingNode = graphStore.getNode(hashtagNodeId);
          if (!existingNode) return false;

          const newContent: Chip[] = [...existingNode.content, { type: "text", value: event.key }];
          graphStore.updateNode({
            nodeId: hashtagNodeId,
            nodeProps: { content: newContent },
          });

          // We have to manually force the editor update because from the editor's perspective nothing has changed here,
          // so it doesn't know that we've updated the hashtag node's content.
          editor.update(() => {
            const graphNode = treeNode.object as GraphNode;
            const currentParagraph = $getRoot().getChildren()[0] as ParagraphNode;
            if (graphNodeMatchesParagraph(graphNode, currentParagraph, graphStore)) {
              return;
            }
            const newParagraph = $createParagraphMatchingGraphNode(graphNode, graphStore);
            currentParagraph.replace(newParagraph);
          });
          return true;
        }

        return false;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, treeNode]);

  // Helper function to update editor content and move cursor
  const updateEditorContent = (newContent: Chip[]) => {
    const graphNode = treeNode.object;
    graphStore.updateNode({ nodeId: graphNode.id, nodeProps: { content: newContent } }).then(() => {
      const sel = treeNode.tree.selection;
      if (sel?.type !== "editor") return;
      if (sel.position === "start" || sel.position === "end") return;
      const newOffset = Math.min(sel.position.anchorOffset, sel.position.focusOffset) + 1;
      treeNode.tree.setFocusedNode(treeNode.id, { anchorOffset: newOffset, focusOffset: newOffset });
    });
  };

  return null;
};
