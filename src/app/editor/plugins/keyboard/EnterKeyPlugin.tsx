import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewType } from "@/app/components/RelatedObject/ViewTypeContext";
import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { useGraphStore } from "@/app/model/useGraphStore";
import { relationsToPathStr } from "@/app/util";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = () => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
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

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event || !graphStore) return false;
        if (viewType === "temp-edit") return false;

        event.preventDefault();
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        const splitToNewBundle = !!metaOrCtrl;

        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;

        if (object instanceof GraphNode) {
          let {
            child: { node: newNode, relation: newRelation },
            nested,
          } = graphStore.splitRelatedNode(relation, object, selection, pathToNodeStr, {
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
          viewController.setFocusedNode(relationsToPathStr(newPath));
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
    object,
    parent,
    pathToNodeStr,
    pathToParentNodes,
    pathToParentRelations,
    relation,
    setViewType,
    viewController,
    viewType,
  ]);

  return null;
};
