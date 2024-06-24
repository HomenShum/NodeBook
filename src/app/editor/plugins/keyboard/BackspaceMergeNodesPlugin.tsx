import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/view/TreeContext";

/**
 * Plugin to merge nodes when backspace is pressed at the start of a node.
 */
export const BackspaceMergeNodesPlugin = () => {
  const graphStore = useGraphStore();
  const renderController = useRenderController();
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
        if (!graphStore) return false;
        event.preventDefault();
        if (object.text === "") {
          if (treeNode.relationWithParent) {
            graphStore.deleteRelation(relation);
            if (treeNode.siblingAbove) {
              renderController.setFocusedNode(treeNode.siblingAbove.path);
            } else {
              renderController.setFocusedNode(treeNode.parent.path);
            }
            return true;
          }
          return false;
        }

        // merge nodes if necessary
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

        if (targetNode && object instanceof GraphNode) {
          targetNode.setContent(targetNode.content.concat(object.content));
          graphStore.removeNode({ nodeId: object.id }).then(() => {
            // TODO: make relation deletion a compound transaction with the above
            graphStore.deleteRelation(relation);
            renderController.setFocusedNode(targetPath!);
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
    renderController,
    tree.pathToRoot,
    treeNode.siblingAbove,
    treeNode.relationWithParent,
    treeNode.parent.path,
    treeNode.parent.parent,
    treeNode.parent.object,
    setRelationComboboxIsOpen,
  ]);

  return null;
};
