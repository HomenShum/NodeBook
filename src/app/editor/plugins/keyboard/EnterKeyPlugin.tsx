import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewType } from "@/app/components/RelatedObject/ViewTypeContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { relationsToPathStr } from "@/app/util";
import { useTree } from "@/app/view/Outline";
import { useViewStore } from "@/app/view/useViewStore";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = () => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const {
    object,
    pathToParentRelations,
    relation,
    pathToParentWithOrderedObjects: pathToParentNodes,
    pathToNodeStr,
    parent,
  } = useRelationAtPath();
  const { viewType, setViewType } = useViewType();
  const tree = useTree();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event || !graphStore) return false;
        if (event.shiftKey) return false;

        event.preventDefault();
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        const splitToNewBundle = !!metaOrCtrl;

        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;

        if (object instanceof GraphNode) {
          const shouldCreateChild = tree.isPathExpanded(pathToNodeStr);
          let {
            child: { node: newNode, relation: newRelation },
            nested,
          } = graphStore.splitRelatedNode(relation, object, selection, shouldCreateChild, {
            splitToNewBundle,
          });
          if (graphStore.correspondingObjectsForPinned.has(relation.id)) {
            newRelation = graphStore.correspondingPinnedForObjects.get(newRelation.id)!;
          }

          // Add to outline if necessary
          graphStore.addElsewhereAfterCreate(newNode, parent, pathToParentNodes[0].child);
          let newPath;
          if (nested) {
            newPath = [...pathToParentRelations, relation, newRelation];
          } else {
            newPath = [...pathToParentRelations, newRelation];
          }
          renderController.setFocusedNode(relationsToPathStr(newPath));
          return true;
        } else {
          // TODO handle related relations
          throw new Error("Splitting relations not yet implemented");
        }
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    graphStore,
    tree,
    object,
    parent,
    pathToNodeStr,
    pathToParentNodes,
    pathToParentRelations,
    relation,
    setViewType,
    renderController,
    viewType,
  ]);

  return null;
};
