import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
import { DescendantTreeNode, PointerTreeNode, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { SelectionState } from "@/app/tree/SelectionState";
import { Tree } from "@/app/tree/Tree";
import { isNoteContent } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

export function useHandleEnterKey(tree: Tree, treeNode: TreeNode) {
  const { addToast } = useToast();
  const viewStore = useViewStore();

  return useCallback(
    (e: KeyboardEvent, chips?: { before: Chip[]; after: Chip[] }) => {
      if (e.key !== "Enter") return false;
      e.preventDefault();
      e.stopPropagation();
      const viewType =
        treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree
          ? viewStore.quickCaptureViewType
          : viewStore.viewType;
      const nodeIsNoteContent = isNoteContent(treeNode);
      const isMod = e.metaKey || e.ctrlKey;

      // Create selection state to track before operation
      const createSelectionState = (operation: SelectionState["operation"]) => {
        // Determine which tree we're in
        let treeType = "main";
        if (treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree) {
          treeType = "quickCapture";
        } else if (viewStore.sidebarTrees.includes(treeNode.tree)) {
          treeType = treeNode.tree.id;
        }

        // Create the selection state
        const selectionState: SelectionState = {
          nodeId: treeNode.object.id,
          previousNodeId: treeNode.object.id, // For enter key, we return to same node
          treeType,
          editorPath: treeNode.path,
          operation,
          position: "start", // Typically after enter we want to start at beginning of new node
          timestamp: Date.now(),
          associatedGraphUpdateIds: [], // Will be filled later with returned relation/node IDs
        };

        return selectionState;
      };

      try {
        //Todo: This can be cleaned up
        if (isMod || treeNode.object.isEditRestricted) {
          if (nodeIsNoteContent && treeNode instanceof DescendantTreeNode) {
            if (chips && chips.after.length === 0 && chips.before.length > 0) {
              // Create a selection state for tracking
              const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

              // Perform the operation
              tree
                .createChildNode({
                  parent: tree.root,
                  after: -1,
                })
                .then((newNode) => {
                  // Update the selectionState with the new node and relation IDs
                  selState.associatedGraphUpdateIds = [newNode.node.id, newNode.relation.id];
                  viewStore.trackSelectionState(selState);
                });

              return true;
            }

            // Create selection state for tracking
            const selState = createSelectionState("SPLIT_NOTE");

            // Perform the operation
            tree.splitNote(treeNode, chips);

            // We don't have a direct way to get the IDs of the created node and relation,
            // but we could inspect the tree state after the operation to find them
            // For now, we'll rely on the operation type for matching
            viewStore.trackSelectionState(selState);

            return true;
          } else {
            // Create selection state for tracking
            const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

            // Perform the operation
            tree.split(treeNode, chips);

            // Since we don't have access to the newly created IDs here,
            // we'll rely on the operation type matching during undo
            viewStore.trackSelectionState(selState);

            return true;
          }
        }

        const childOfTreeRoot = treeNode.parent instanceof RootTreeNode;
        if (
          !nodeIsNoteContent &&
          viewType === "note" &&
          childOfTreeRoot &&
          treeNode instanceof DescendantTreeNode &&
          treeNode.relationWithParent.relationType.label !== "child"
        ) {
          // Create selection state for tracking
          const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

          // Perform the operation
          tree.convertToNote(treeNode, true);

          // Track selection state
          viewStore.trackSelectionState(selState);

          return true;
        }

        if (!nodeIsNoteContent && ((viewType === "note" && childOfTreeRoot) || e.shiftKey)) {
          // Create selection state for tracking
          const selState = createSelectionState("SPLIT_NOTE");

          // Perform the operation
          tree.splitIntoNote(treeNode, chips);

          // Track selection state
          viewStore.trackSelectionState(selState);

          return true;
        }

        if (treeNode instanceof PointerTreeNode) {
          addToast({
            title: "Cannot split while sublists are flattened",
          });
          return false;
        }

        // Create selection state for tracking
        const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

        // Perform the operation
        tree.split(treeNode, chips);

        // Track selection state
        viewStore.trackSelectionState(selState);

        return true;
      } catch (error) {
        console.error("Error during enter key operation:", error);
        return false;
      }
    },
    [treeNode, viewStore.quickCaptureViewType, viewStore.viewType, tree, addToast, viewStore],
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
