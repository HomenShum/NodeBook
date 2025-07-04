import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useCallback, useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { $atEditorStart } from "@/app/editor/utils/selection";
import { defaultRelationTypes } from "@/app/graph/constants";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";
import { DescendantTreeNode, PointerTreeNode, TreeNode } from "@/app/tree/nodes";
import { TreeNodeContentSelectionPosition } from "@/app/tree/selection";
import { SelectionState } from "@/app/tree/SelectionState";
import { Tree } from "@/app/tree/Tree";
import { useTree } from "@/app/tree/TreeContext";
import { getNextAbove } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

/**
 * Concat two arrays of Chips into one.
 * Merges the chip at the end of the first array with the chip at the start of the second array.
 */
const concatChips = (targetNodeChips: Chip[], sourceNodeChips: Chip[]): Chip[] => {
  const lastChip = targetNodeChips[targetNodeChips.length - 1];
  const firstChip = sourceNodeChips[0];
  if (lastChip?.type === "text" && firstChip?.type === "text") {
    return [
      ...targetNodeChips.slice(0, targetNodeChips.length - 1),
      { type: "text", value: lastChip.value + firstChip.value },
      ...sourceNodeChips.slice(1),
    ];
  } else {
    return [...targetNodeChips, ...sourceNodeChips];
  }
};

/**
 * Plugin to merge nodes when backspace is pressed at the start of a node.
 */
export const BackspaceMergeNodesPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const tree = useTree();
  const viewStore = useViewStore();
  const { mergeNodes, addSiblingAboveIntoNote } = useMergers(treeNode.tree);
  const graphStore = useGraphStore();
  const user = useUser();
  const ignoreMergeCommand = user.isAnonymous;

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        // Skip non-children. That's handled by the RelationPlugin
        const isChild =
          treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id &&
          treeNode.relationWithParent.to === treeNode.object;
        if (!isChild) {
          return false;
        }
        // Only merge while at the start of the node
        if (!$atEditorStart() || ignoreMergeCommand) {
          return false;
        }
        if (treeNode instanceof PointerTreeNode) {
          return false;
        }
        let handled = false;
        if (event.metaKey || event.ctrlKey) {
          if (treeNode.object.text === "" && treeNode.relationWithParent.relationType !== defaultRelationTypes.child) {
            // set the relationType to child
            graphStore.updateRelation({
              relationId: treeNode.relationWithParent.id,
              relationProps: { relationType: defaultRelationTypes.child },
              reverse: false,
            });
            handled = true;
          }
        } else if (
          // We're at the start of the first child of a note
          treeNode.parentGroup.id === "noteContent" &&
          treeNode.parentGroup.nodes[0] === treeNode &&
          treeNode.parent instanceof DescendantTreeNode
        ) {
          if (treeNode.parentGroup.nodes.length === 1 && treeNode.object.text.length === 0) {
            // Inside last child of the note and it's empty.
            handled = mergeNodes(treeNode, treeNode.parent, treeNode.parent.id);
          } else if (treeNode.parent.siblingAbove && treeNode.parent.siblingAbove.object instanceof GraphNode) {
            if (treeNode.parent.siblingAbove.childrenGroupsById.noteContent.nodes.length > 0) {
              // Merge note into note above
              handled = mergeNodes(treeNode.parent, treeNode.parent.siblingAbove);
            } else {
              // Go into prefix
              // const prefixInput = document.querySelector(`[data-note-prefix="${treeNode.parent.object.id}"]`);
              // if (prefixInput && prefixInput instanceof HTMLInputElement) {
              //   prefixInput.focus();
              //   handled = true;
              // } else {
              //   handled = false;
              // }
              // Destroy multiline note
              treeNode.tree.convertMultiLineNoteToNode(treeNode, false);
              handled = true;
            }
          }
        } else if (treeNode.siblingAbove) {
          // Merge into sibling above's last node above, or sibling above if it has no children
          const nextNodeAbove = getNextAbove(treeNode);

          // Don't allow merge if the node above is edit restricted.
          if (nextNodeAbove && nextNodeAbove.object.isEditRestricted) {
            return false;
          }

          handled = mergeNodes(treeNode, nextNodeAbove || treeNode.siblingAbove);
        } else if (treeNode.parent) {
          // Merge into parent
          handled = mergeNodes(treeNode, treeNode.parent);
        }

        // If the node above is has a treeNodeInputSuffix and the current node is empty, destroy the node
        //   and focus on the input suffix
        if (
          treeNode.siblingAbove &&
          (treeNode.siblingAbove.object instanceof GraphRelation ||
            treeNode.siblingAbove.object.canonicalRelationId !== treeNode.siblingAbove.relationWithParent.id) &&
          treeNode.object.text === ""
        ) {
          if (treeNode.siblingAbove.object instanceof GraphRelation) {
            graphStore.removeNode({
              nodeId: treeNode.object.id,
            });
          }
          const element = document.querySelector(`[data-object-suffix="${treeNode.siblingAbove.id}"]`);
          if (element && element instanceof HTMLInputElement) {
            element.focus();
          }
        }
        if (handled) {
          const destroyMLNote =
            treeNode.parentGroup.id === "noteContent" &&
            treeNode.parent.childrenGroupsById["noteContent"].nodes.length === 2 &&
            treeNode.parent.childrenGroupsById["noteContent"].nodes[1] === treeNode &&
            ((tree.selection !== null && tree.selection.type === "editor") ||
              (viewStore.quickCaptureOpen &&
                viewStore.quickCaptureTree.selection !== null &&
                viewStore.quickCaptureTree.selection.type === "editor"));

          if (destroyMLNote) {
            const firstNoteNode = treeNode.parent.childrenGroupsById["noteContent"].nodes[0];
            if (firstNoteNode) {
              treeNode.tree.convertMultiLineNoteToNode(firstNoteNode, true);
            }
          }
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    mergeNodes,
    addSiblingAboveIntoNote,
    treeNode,
    tree,
    graphStore,
    ignoreMergeCommand,
    viewStore.quickCaptureOpen,
    viewStore.quickCaptureTree.selection,
  ]);

  return null;
};

/**
 * Hook returns helper functions for merging tree nodes.
 */
function useMergers(tree: Tree) {
  const graphStore = useGraphStore();

  /**
   * Creates a selection state for tracking purposes
   */
  const createSelectionState = useCallback(
    (source: DescendantTreeNode, target: TreeNode): SelectionState => {
      // Determine which tree we're in
      let treeType = "main";
      if (tree.isMainTree) {
        treeType = "main";
      } else if (tree.viewType === "note") {
        treeType = "quickCapture";
      } else {
        treeType = tree.id;
      }

      // Get the current position from the tree's selection
      // For backspace merges, we'll want to restore to the start of the source node after undo
      let position: TreeNodeContentSelectionPosition = "start";

      // The key insight for backspace merge undo is to capture:
      // 1. The source node ID (which will be recreated during undo)
      // 2. The target node path (where the content was merged to)
      // 3. The source node path (which will no longer exist but helps for debugging)

      // Create the selection state
      const selectionState: SelectionState = {
        nodeId: source.object.id, // The source node that's being merged from
        previousNodeId: target.object.id, // The target node that's being merged into
        treeType,
        editorPath: source.path, // Store source path for reference
        operation: "BACKSPACE_MERGE",
        position,
        timestamp: Date.now(),
        associatedGraphUpdateIds: [],
      };

      return selectionState;
    },
    [tree],
  );

  /**
   * Merges a source node into a target node. If the target node is a note,
   * the source node is converted to a regular node.
   */
  const mergeNodes = useCallback(
    (source: DescendantTreeNode, target: TreeNode, focusPath?: string) => {
      if (!(target.object instanceof GraphNode && source.object instanceof GraphNode)) {
        return false;
      }
      // Prevent deletion of the last relation of the current root node
      // Otherwise the node gets deleted too in the recurrent process, after deleting the last relation
      if (target === tree.root && target.object.allRelationsList.size === 1) {
        return false;
      }

      // Create selection state for tracking
      const selState = createSelectionState(source, target);

      // Mark that the next update will have selection state
      const updateManager = tree.getUpdateManager();
      if (updateManager) {
        updateManager.nextUpdateHasSelectionState = true;
      }

      const txs: TxCombinedPart[] = [
        // Update all relations to point to the target node
        ...source.object.relations
          .filter((r) => r.id != source.relationWithParent.id)
          .map((r) => {
            return {
              type: "replaceRelationLink",
              transaction: {
                relationId: r.id,
                direction: r.from.id === source.object.id ? "from" : "to",
                replaceWith: { type: "existing-object", id: target.object.id },
              },
            } satisfies TxCombinedPart;
          }),
        // Add all pinned relations to the target node
        {
          type: "addRelationToList",
          transaction: {
            objectId: target.object.id,
            relationId: source.object.pinnedRelationsList.keys,
            listType: "pinned",
            after: -1,
          },
        },
        // Add all note content relations to the target node
        {
          type: "addRelationToList",
          transaction: {
            objectId: target.object.id,
            relationId: source.object.noteContentRelationsList.keys,
            listType: "noteContent",
            after: -1,
          },
        },
        // Merge the nodes together
        {
          type: "updateNode",
          transaction: {
            nodeId: target.object.id,
            nodeProps: {
              content: concatChips(target.object.content, source.object.content),
            },
          },
        },
        { type: "removeRelation", transaction: { relationId: source.relationWithParent.id } },
      ];

      // Use the focus path if provided. Otherwise, focus the last node in the
      // note content list if it exists, otherwise focus the target node itself
      if (!focusPath) {
        focusPath =
          target.object.noteContentRelationsList.size > 0
            ? target.childrenGroupsById.noteContent.nodes[target.childrenGroupsById.noteContent.nodes.length - 1].path
            : target.path;
      }
      const targetTextLength = target.object.text.length;
      graphStore.applyCombinedTransaction(txs);

      // Get the transaction ID and track the selection state
      if (updateManager?.lastTransactionId) {
        const transactionId = updateManager.lastTransactionId;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("track-selection-state", {
              detail: {
                selectionState: selState,
                transactionId,
              },
            }),
          );
        }
      }

      const sourceWasExpanded = source.isExpanded && source.childCount > 0;
      if (!target.isExpanded && sourceWasExpanded) {
        // If the source was expanded, expand the target
        tree.setPathExpanded(target.path, true);
      }

      // Use setTimeout to ensure the content update has propagated before setting selection
      // This prevents timing issues where the selection calculation happens before the content is fully updated
      setTimeout(() => {
        tree.setFocusedNode(focusPath, {
          anchorOffset: targetTextLength,
          focusOffset: targetTextLength,
        });
      }, 0);
      return true;
    },
    [graphStore, tree, createSelectionState],
  );

  const addSiblingAboveIntoNote = useCallback(
    (note: DescendantTreeNode) => {
      if (!note.siblingAbove) return false;

      // Create selection state for tracking
      const selState = createSelectionState(note.siblingAbove, note);

      // Mark that the next update will have selection state
      const updateManager = tree.getUpdateManager();
      if (updateManager) {
        updateManager.nextUpdateHasSelectionState = true;
      }

      const txs: TxCombinedPart[] = [
        {
          type: "replaceRelationLink",
          transaction: {
            relationId: note.siblingAbove.relationWithParent.id,
            direction: note.siblingAbove.relationWithParent.to.id === note.siblingAbove.object.id ? "from" : "to",
            replaceWith: {
              type: "existing-object",
              id: note.object.id,
            },
          },
        },
        {
          type: "addRelationToList",
          transaction: {
            objectId: note.object.id,
            relationId: note.siblingAbove.relationWithParent.id,
            listType: "noteContent",
          },
        },
      ];
      const siblingAboveExpanded = note.siblingAbove.isExpanded;
      const path = note.childrenGroupsById.noteContent.createChildPath(note.siblingAbove.relationWithParent);
      graphStore.applyCombinedTransaction(txs);

      // Get the transaction ID and track the selection state
      if (updateManager?.lastTransactionId) {
        const transactionId = updateManager.lastTransactionId;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("track-selection-state", {
              detail: {
                selectionState: selState,
                transactionId,
              },
            }),
          );
        }
      }

      if (siblingAboveExpanded) {
        tree.setPathExpanded(path, true);
      }
      tree.setFocusedNode(path);

      return true;
    },
    [graphStore, tree, createSelectionState],
  );

  return { mergeNodes, addSiblingAboveIntoNote };
}
