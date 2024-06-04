import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND, KEY_TAB_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useSettingsStore } from "@/app/model/useSettingsStore";
import { relationsToPathStr } from "@/app/util";
/**
 * Plugin to move current node using Tab/Shift+Tab. Also handles bulleting by typing '-' at the start of a line.
 */
export const TabAndBulletPlugin = () => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const {
    pathToParentRelations,
    relation,
    pathToParentWithOrderedObjects: pathToParentNodes,
    siblingAbove,
    parent,
  } = useRelationAtPath();

  const viewRoot = pathToParentNodes[0].child;
  const tabBullet = useCallback(
    (event: KeyboardEvent | null) => {
      if (!graphStore) return false;
      event?.preventDefault();
      let baseRelation;
      if (parent.isRelationPinned(relation)) {
        if (graphStore.correspondingObjectsForPinned.has(relation.id)) {
          baseRelation = graphStore.correspondingObjectsForPinned.get(relation.id)!;
        } else {
          baseRelation = relation;
        }
        parent.unpinChildRelation(relation);
      } else {
        baseRelation = relation;
      }

      if (event?.shiftKey) {
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
          !settingsStore.allowShiftTabAboveViewRoot &&
          visibleRootRelations &&
          visibleRootRelations.length == pathToParentNodes.length
        ) {
          console.log("Can't shift tab because grandparent is above view root");
          return false;
        }

        const grandparentNode = pathToParentNodes[pathToParentNodes.length - 1].parent;
        const parentRelation = pathToParentRelations[pathToParentRelations.length - 1];
        if (!grandparentNode) {
          console.log("Can't shift tab because no grandparent to move to");
          return false;
        }
        if (grandparentNode.id === graphStore.userRoot.id) {
          console.log("Can't move relation to user root");
          return false;
        }
        if (!parent) {
          console.log("Can't shift tab because no parent to move to");
          return false;
        }
        // Replace the relations pointer to the parent with the grandparent
        if (baseRelation.from.id === parent.id) {
          graphStore.updateRelationFrom(baseRelation, grandparentNode);
        } else {
          graphStore.updateRelationTo(baseRelation, grandparentNode);
        }
        // Position the relation under the parent
        graphStore.getRelationList(grandparentNode).move([baseRelation], parentRelation);
        viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations.slice(0, -1), baseRelation]));
        return true;
      } else {
        if (!siblingAbove) {
          console.log("Sibling not found");
          return false;
        }
        const siblingAboveNode = siblingAbove.from.id === parent.id ? siblingAbove.to : siblingAbove?.from;
        // Change the relation's parent to the sibling above
        if (baseRelation.from.id === parent.id) {
          graphStore.updateRelationFrom(baseRelation, siblingAboveNode);
        } else {
          graphStore.updateRelationTo(baseRelation, siblingAboveNode);
        }
        // Position the relation at the bottom of the siblings list
        graphStore.getRelationList(siblingAboveNode).move([baseRelation], "bottom");
        // toggle open sibling
        const relationPathToSibling = [...pathToParentRelations, siblingAbove];
        graphStore.setPathExpanded(relationsToPathStr(relationPathToSibling), true);
        // set focus at the relations new path
        viewController.setFocusedNode(relationsToPathStr([...relationPathToSibling, baseRelation]));
        return true;
      }
    },
    [
      graphStore,
      parent,
      pathToParentNodes,
      pathToParentRelations,
      relation,
      settingsStore.allowShiftTabAboveViewRoot,
      siblingAbove,
      viewController,
    ],
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key === "-" && viewRoot.id === graphStore.thoughtstreamRoot.id) {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const startEnd = selection.getStartEndPoints();
            if (!startEnd) return false;
            const [selectionStart, selectionEnd] = startEnd;

            // Offset is 0 when at start of text
            if (selectionStart.offset !== 0 || selectionEnd.offset !== 0) return false;
            if (!siblingAbove) return false;
            tabBullet(null);
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        action((event: KeyboardEvent) => tabBullet(event)),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, siblingAbove, tabBullet]);

  return null;
};
