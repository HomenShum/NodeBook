import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useCallback, useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";
import { DescendantTreeNode, PointerTreeNode, TreeNode } from "@/app/tree/nodes";
import { Tree } from "@/app/tree/Tree";
import { getNextAbove } from "@/app/tree/utils";
import { $atEditorStart } from "@/app/editor/utils/selection";

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
  const { mergeNodes, addSiblingAboveIntoNote } = useMergers(treeNode.tree);

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
        if (!$atEditorStart()) {
          return false;
        }
        if (treeNode instanceof PointerTreeNode) {
          return false;
        }

        let handled = false;
        if (
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
              // Merge note into bullet above
              handled = addSiblingAboveIntoNote(treeNode.parent);
            }
          }
        } else if (treeNode.siblingAbove) {
          // Merge into sibling above's last node above, or sibling above if it has no children
          const nextNodeAbove = getNextAbove(treeNode);
          handled = mergeNodes(treeNode, nextNodeAbove || treeNode.siblingAbove);
        } else if (treeNode.parent) {
          // Merge into parent
          handled = mergeNodes(treeNode, treeNode.parent);
        }
        if (handled) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, mergeNodes, addSiblingAboveIntoNote, treeNode]);

  return null;
};

/**
 * Hook returns helper functions for merging tree nodes.
 */
function useMergers(tree: Tree) {
  const graphStore = useGraphStore();

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
      const sourceWasExpanded = source.isExpanded;
      graphStore.applyCombinedTransaction(txs);
      // If the source was expanded, expand the target
      if (sourceWasExpanded) {
        tree.setPathExpanded(target.path, true);
      }
      tree.setFocusedNode(focusPath, {
        anchorOffset: targetTextLength,
        focusOffset: targetTextLength,
      });
      return true;
    },
    [graphStore, tree],
  );

  const addSiblingAboveIntoNote = useCallback(
    (note: DescendantTreeNode) => {
      if (!note.siblingAbove) return false;
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
      if (siblingAboveExpanded) {
        tree.setPathExpanded(path, true);
      }
      tree.setFocusedNode(path);

      return true;
    },
    [graphStore, tree],
  );

  return { mergeNodes, addSiblingAboveIntoNote };
}