import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $setSelection, EditorState, ParagraphNode } from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect } from "react";

import { $getChips, createParagraphMatchingGraphNode, graphNodeMatchesParagraph } from "@/app/editor/utils";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";

/**
 * When the graph object content changes, the editor content is updated to
 * match. It only applies a change if the new state is different from the
 * current state, to avoid infinite loops.
 */
export const SyncWithGraphPlugin = observer(({ node }: { node: GraphNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const updateGraphOnEditorChange = useCallback(
    async (editorState: EditorState) => {
      // exit early if the editor doesn't have focus or the node hasn't changed
      const editorHasFocus = editor.getRootElement()?.contains(document.activeElement);
      if (!editorHasFocus) {
        return;
      }
      const unchanged = editorState.read(() => {
        const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
        return graphNodeMatchesParagraph(node, paragraph, graphStore);
      });
      if (unchanged) {
        return;
      }

      // Update the graph
      const chips = editorState.read($getChips);
      // update the node's content
      await graphStore.updateNode({ nodeId: node.id, nodeProps: { content: chips } });
      // force the nodes with mentions of this node to update. (TODO: This is a
      // hack. Ideally the nodes would update reactively. Also, it doesn't
      // cover case where a node mentions another but we've deleted that
      // relation.)
      const mentionUpdates = node.relations
        .map((relation) => (relation.from.id === node.id ? relation.to : relation.from))
        .filter((obj): obj is GraphNode => {
          return (
            obj instanceof GraphNode && obj.content.some((item) => item.type === "mention" && item.value === node.id)
          );
        });
      for (const obj of mentionUpdates) {
        await graphStore.updateNode({ nodeId: obj.id, nodeProps: { content: [...obj.content] } });
      }
    },
    [editor, graphStore, node],
  );

  const setEditorToGraphNodeText = useCallback(
    (graphNode: GraphNode) => {
      const focusedBefore = editor.getRootElement()?.contains(document.activeElement);
      editor.update(() => {
        const currentParagraph = $getRoot().getChildren()[0] as ParagraphNode;
        if (graphNodeMatchesParagraph(graphNode, currentParagraph, graphStore)) {
          return;
        }
        const newParagraph = createParagraphMatchingGraphNode(graphNode, graphStore);
        currentParagraph.replace(newParagraph);
        /**
         * Setting the selection to null here seems to prevent the error below.
         * Based on https://stackoverflow.com/a/72197580, it seems that when we're
         * updating the editor state on a non-focused editor, a new selection is
         * automatically set in the new editor state, and then the editor takes
         * the dom selection away from the user, leading to other downstream issues.
         *
         * ```
         * Error: updateEditor: selection has been lost because the previously
         * selected nodes have been removed and selection wasn't moved to
         * another node. Ensure selection changes after removing/replacing a
         * selected node.
         * ```
         */
        $setSelection(null);
        // We lose the focus when we do this update, so we need to refocus
        if (focusedBefore) editor.focus();
      });
    },
    [editor, graphStore],
  );

  useEffect(() => {
    setEditorToGraphNodeText(node);
  }, [setEditorToGraphNodeText, node, node.content]);

  useEffect(() => {
    const unsubscribe = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      updateGraphOnEditorChange(editorState);
    });
    return unsubscribe;
  }, [editor, updateGraphOnEditorChange]);

  return null;
});
