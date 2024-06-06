import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_BACKSPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { useGraphStore } from "@/app/model/useGraphStore";
import { relationsToPathStr } from "@/app/util";

/**
 * Plugin to merge nodes when backspace is pressed at the start of a node.
 */
export const BackspaceMergeNodesPlugin = () => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
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
              viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
            } else {
              viewController.setFocusedNode(relationsToPathStr(pathToParentRelations));
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
          const viewRoot = pathToParentNodes[0].child;
          let visibleRootRelations;
          if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
            visibleRootRelations = viewController.currentStreamViewRoot;
          } else if (viewRoot.id === graphStore.outlineRoot.id) {
            visibleRootRelations = viewController.currentOutlineViewRoot;
          } else {
            throw new Error("Unknown view root");
          }

          if (
            visibleRootRelations &&
            visibleRootRelations.length < pathToParentNodes.length &&
            parent instanceof GraphNode
          ) {
            targetNode = parent;
            targetPath = relationsToPathStr([...pathToParentRelations]);
          }
        }

        if (targetNode && object instanceof GraphNode) {
          targetNode.setContent(targetNode.content.concat(object.content));
          graphStore.deleteNode(object.id);
          graphStore.deleteRelation(relation);
          viewController.setFocusedNode(targetPath!);
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
    viewController,
  ]);

  return null;
};
