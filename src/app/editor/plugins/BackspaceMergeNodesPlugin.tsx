import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";
import { defaultRelationTypes } from "@/app/graph/constants";
import { useTree } from "@/app/tree/TreeContext";
import { PointerTreeNode } from "@/app/tree/nodes";

/**
 * Plugin to merge nodes when backspace is pressed at the start of a node.
 */
export const BackspaceMergeNodesPlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode, setRelationComboboxIsOpen } = useTreeNode();

  const object = treeNode.object;
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        // It only should happen for the child relation since there is different
        // logic at work for the other relation types in RelationPlugin
        if (!graphStore || relation.relationType.id !== defaultRelationTypes.child.id) return false;
        event.preventDefault();

        if (treeNode instanceof PointerTreeNode) {
          return false;
        }

        //We want to merge nodes if the cursor is before the first
        //character and backspace is pressed.

        //This also implies that we need to reassign all the
        //children of the old node to the new node.

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const startEnd = selection.getStartEndPoints();
        if (!startEnd) return false;
        const [selectionStart, selectionEnd] = startEnd;

        // Offset is 0 when at start of text
        if (selectionStart.offset !== 0 || selectionEnd.offset !== 0) return false;

        if (relation.relationType.id !== defaultRelationTypes.child.id) {
          setRelationComboboxIsOpen(true);
          return true;
        }

        let targetNode = null;
        let targetPath = null;
        if (treeNode.siblingAbove) {
          if (treeNode.siblingAbove.object instanceof GraphNode) {
            targetNode = treeNode.siblingAbove.object;
            targetPath = treeNode.siblingAbove.path;
          }
        } else {
          if (treeNode.parent.parent && treeNode.parent.object instanceof GraphNode) {
            targetNode = treeNode.parent.object;
            targetPath = treeNode.parent.path;
          }
        }

        if (!targetNode) {
          return false;
        }

        //Update all child nodes to point to the targetNode. We want to delete the
        //edge/relation between the "node to be deleted" and it's parent so ignore and do
        //not update that relation.
        const updateRelationTxs: TxCombinedPart[] = object.relations
          .filter((r) => r.id != relation.id)
          .map((r) => {
            return {
              type: "replaceRelationLink",
              transaction: {
                relationId: r.id,
                direction: r.from.id === object.id ? "from" : "to",
                replaceWith: { type: "existing-object", id: targetNode.id },
              },
            };
          });

        if (targetNode && object instanceof GraphNode) {
          graphStore
            .applyCombinedTransaction([
              ...updateRelationTxs,
              {
                type: "updateNode",
                transaction: {
                  nodeId: targetNode.id,
                  nodeProps: { content: targetNode.content.concat(object.content) },
                },
              },
              { type: "removeRelation", transaction: { relationId: relation.id } },
            ])
            .catch(() => {}) // TODO: investigate missing relation error
            .finally(() => {
              if (targetPath) {
                if (treeNode.isExpanded) {
                  tree.setPathExpanded(targetPath, treeNode.isExpanded);
                }
                tree.setFocusedNode(targetPath);
              }
            });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    graphStore,
    object,
    parent,
    relation,
    tree.pathToRoot,
    treeNode,
    treeNode.siblingAbove,
    treeNode.relationWithParent,
    treeNode.parent.path,
    treeNode.parent.parent,
    treeNode.parent.object,
    setRelationComboboxIsOpen,
    tree,
  ]);

  return null;
};
