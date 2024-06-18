import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { relationsToPathStr } from "@/app/util";
import { useTree } from "@/app/view/Outline";
import { useViewStore } from "@/app/view/useViewStore";

/**
 * Plugin to merge nodes when backspace is pressed at the start of a node.
 */
export const BackspaceMergeNodesPlugin = () => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const {
    object,
    pathToParentRelations,
    relation,
    pathToParentWithOrderedObjects: pathToParentNodes,
    siblingAbove,
    parent,
    openRelationTypeMenu,
  } = useRelationAtPath();
  const tree = useTree();

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        if (!graphStore) return false;
        event.preventDefault();
        if (object.text === "") {
          const parentRelation = pathToParentRelations[pathToParentRelations.length - 1];
          if (parentRelation) {
            graphStore.deleteRelation(relation);
            if (siblingAbove) {
              renderController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
            } else {
              renderController.setFocusedNode(relationsToPathStr(pathToParentRelations));
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
          openRelationTypeMenu();
          return true;
        }
        let targetNode = null;
        let targetPath = null;
        if (siblingAbove) {
          const node = siblingAbove.from.id === parent.id ? siblingAbove.to : siblingAbove.from;
          if (node instanceof GraphNode) {
            targetNode = node;
            targetPath = relationsToPathStr([...pathToParentRelations, siblingAbove]);
          }
        } else {
          if (tree.root.length < pathToParentNodes.length && parent instanceof GraphNode) {
            targetNode = parent;
            targetPath = relationsToPathStr([...pathToParentRelations]);
          }
        }

        if (targetNode && object instanceof GraphNode) {
          targetNode.setContent(targetNode.content.concat(object.content));
          graphStore.deleteNode(object.id);
          graphStore.deleteRelation(relation);
          renderController.setFocusedNode(targetPath!);
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
    pathToParentNodes,
    pathToParentRelations,
    relation,
    siblingAbove,
    renderController,
    openRelationTypeMenu,
    tree.root,
  ]);

  return null;
};
