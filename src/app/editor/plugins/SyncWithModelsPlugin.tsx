import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $setSelection, ParagraphNode } from "lexical";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $createParagraphMatchingGraphNode, $getChips, graphNodeMatchesParagraph } from "@/app/editor/utils/content";
import { $getSelectionPosition, $setSelectionFromTree, sameSelectionPositions } from "@/app/editor/utils/selection";
import { GraphNode } from "@/app/graph/GraphNode";
import { TreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

interface Props {
  node: GraphNode;
  treeNode: TreeNode;
}

/**
 * Sync the editor content and selection with the graph node content and selection.
 */
export const SyncWithModelsPlugin = observer(function SyncWithGraphPlugin({ node, treeNode }: Props) {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const treeNodeId = treeNode.id;
  const tree = treeNode.tree;
  const viewStore = useViewStore();

  // Editor -> App state: update the app state to match the editor content
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // We assume that if the editor is focused, the change is due to the user
      // input. If it's not, we ignore the pushing the update to the app state.
      if (!editor.getRootElement()?.contains(document.activeElement)) return;
      // Set the tree selection to the editor selection
      const editorSelectionPosition = editorState.read($getSelectionPosition);
      const match =
        tree.selection?.type === "editor" &&
        tree.selection.treeNodeId === treeNodeId &&
        sameSelectionPositions(editorSelectionPosition, tree.selection.position);
      if (!match) {
        tree.setFocusedNode(treeNodeId, editorSelectionPosition, true);
      }

      // Update the graph if the editor content has changed
      const noChange = editorState.read(() => {
        const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
        return graphNodeMatchesParagraph(node, paragraph, graphStore);
      });
      if (noChange) return;
      const chips = editorState.read($getChips);
      graphStore.updateNode({ nodeId: node.id, nodeProps: { content: chips } });
    });
  }, [editor, graphStore, node, tree, treeNodeId]);

  // App state -> Editor: update the editor content to match the graph node
  useEffect(() => {
    editor.update(() => {
      const currentParagraph = $getRoot().getChildren()[0] as ParagraphNode;
      if (graphNodeMatchesParagraph(node, currentParagraph, graphStore)) {
        return;
      }
      const newParagraph = $createParagraphMatchingGraphNode(node, graphStore);
      currentParagraph.replace(newParagraph);
      /**
       * Setting the selection is required to prevent the error below.
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
      const isFocused = editor.getRootElement()?.contains(document.activeElement);
      if (tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNodeId && isFocused) {
        $setSelectionFromTree(tree.selection);
        editor.focus();
      } else {
        $setSelection(null);
      }
    });
  }, [editor, graphStore, node, node.content, tree.selection, treeNodeId]);

  // App state -> Editor: update the editor selection/focus to match the tree selection
  useEffect(() => {
    const $applyTreeSelectionToEditor = () => {
      const isFocused = editor.getRootElement()?.contains(document.activeElement);
      switch (tree.selection?.type) {
        case undefined: {
          // If there was a dragging event with mouseup outside the editor, don't blur. Otherwise blur.
          if (isFocused && !viewStore.isMouseUpAfterDrag) {
            editor.blur();
          }
          break;
        }
        case "node": {
          // When the selection switches to node type, blur all editors
          if (isFocused) {
            // If focused, remove focus from editor so we do not see the
            // cursor but keep it in the same pane/div because we listen
            // for keydown events on its ancestor, OutlineContent.tsx.
            // editor.blur();
            document.getElementById(treeNode.tree.id)?.focus();
          }
          break;
        }
        case "editor": {
          if (tree.selection.treeNodeId === treeNodeId) {
            if (!isFocused) {
              // tree.selection.scrollToCenter &&
              //   editor.getRootElement()?.scrollIntoView({
              //     behavior: "instant", //scrollIntoView with "smooth" causes a reflow in mew
              //     block: "center",
              //   });
              // console.log("scrolled");
              editor.focus();
            }
            const editorSelectionPosition = editor.getEditorState().read($getSelectionPosition);
            if (!sameSelectionPositions(editorSelectionPosition, tree.selection.position)) {
              $setSelectionFromTree(tree.selection);
            }
          } else if (isFocused && tree.selection.treeNodeId !== treeNodeId) {
            // Editor is focused but shouldn't be -> blur it
            editor.blur();
          }
          break;
        }
        default: {
          return tree.selection satisfies never;
        }
      }
    };

    // Apply when tree selection changes or when the editor is made editable
    editor.update($applyTreeSelectionToEditor);
    return editor.registerEditableListener((currentIsEditable) => {
      if (currentIsEditable) {
        editor.update($applyTreeSelectionToEditor);
      }
    });
  }, [editor, tree, treeNodeId, tree.selection, viewStore.isMouseUpAfterDrag, treeNode.tree.id]);

  return null;
});
