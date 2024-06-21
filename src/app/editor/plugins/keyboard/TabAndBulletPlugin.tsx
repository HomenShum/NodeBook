import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND, KEY_TAB_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import { createPath, useTree } from "@/app/view/Tree";
/**
 * Plugin to move current node using Tab/Shift+Tab. Also handles bulleting by typing '-' at the start of a line.
 */
export const TabAndBulletPlugin = () => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const renderController = useRenderController();
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
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
        if (!settingsStore.allowShiftTabAboveViewRoot && tree.rootObject.id === treeNode.parent.object.id) {
          console.log("Can't shift tab because grandparent is above view root");
          return false;
        }

        const parent = treeNode.parent;
        const grandparent = parent?.parent;
        if (!grandparent) {
          console.log("Can't shift tab because no grandparent to move to");
          return false;
        }
        if (grandparent.object.id === graphStore.userRoot.id) {
          console.log("Can't move relation to user root");
          return false;
        }
        if (!parent.relationWithParent) {
          console.log("Can't shift tab because no visible parent to move to");
          return false;
        }
        // Replace the relations pointer to the parent with the grandparent
        if (baseRelation.from.id === parent.object.id) {
          graphStore.updateRelationFrom(baseRelation, grandparent.object);
        } else {
          graphStore.updateRelationTo(baseRelation, grandparent.object);
        }
        // Position the relation under the parent
        graphStore.getRelationList(grandparent.object).move([baseRelation], parent.relationWithParent);

        const id = createPath(grandparent.path, treeNode.group, baseRelation.id);
        renderController.setFocusedNode(id);
        return true;
      } else {
        const siblingAbove = treeNode.siblingAbove;
        if (!siblingAbove) {
          console.log("Sibling not found");
          return false;
        }
        // Change the relation's parent to the sibling above
        if (!treeNode.isBackrelation) {
          graphStore.updateRelationFrom(baseRelation, siblingAbove.object);
        } else {
          graphStore.updateRelationTo(baseRelation, siblingAbove.object);
        }
        // Position the relation at the bottom of the siblings list
        graphStore.getRelationList(siblingAbove.object).move([baseRelation], "bottom");
        // toggle open sibling
        tree.setPathExpanded(siblingAbove.path, true);
        // set focus at the relations new path
        const id = createPath(siblingAbove.path, treeNode.group, baseRelation.id);
        renderController.setFocusedNode(id);
        return true;
      }
    },
    [graphStore, parent, relation, settingsStore.allowShiftTabAboveViewRoot, renderController, tree, treeNode],
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key === "-" && tree.rootObject.id === graphStore.thoughtstreamRoot.id) {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return false;

            const startEnd = selection.getStartEndPoints();
            if (!startEnd) return false;
            const [selectionStart, selectionEnd] = startEnd;

            // Offset is 0 when at start of text
            if (selectionStart.offset !== 0 || selectionEnd.offset !== 0) return false;
            if (!treeNode.siblingAbove) return false;
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
  }, [editor, graphStore.thoughtstreamRoot.id, treeNode, tabBullet, tree.rootObject.id]);

  return null;
};
