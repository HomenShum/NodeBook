import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/graph/useGraphStore";
/**
 * Plugin to move current node using Cmd + Shift + ArrowUp/ArrowDown.
 */
export const ArrowKeyMoveNodePlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const siblingAbove = treeNode.siblingAbove;
  const siblingBelow = treeNode.siblingBelow;
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (metaOrCtrl && event.shiftKey && event.key === "ArrowUp") {
          if (!siblingAbove) return false;
          event.preventDefault();
          graphStore.getRelationList(parent).move([siblingAbove.relationWithParent], relation);
          // While in thoughtstream view, move relation into the same bundle as the sibling above
          if (parent.id === graphStore.thoughtstreamRoot.id) {
            const siblingAboveBundle = graphStore.relationToBundles.get(siblingAbove.object.id)?.[0];
            const thisBundle = graphStore.relationToBundles.get(relation.id)?.[0];
            if (siblingAboveBundle && thisBundle?.id !== siblingAboveBundle?.id) {
              if (thisBundle) {
                graphStore.removeFromBundle(relation, thisBundle);
              }
              graphStore.addToBundle(relation, siblingAboveBundle);
            }
          }
          return true;
        } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowDown") {
          if (!siblingBelow) return false;
          event.preventDefault();
          graphStore.getRelationList(parent).move([relation], siblingBelow.relationWithParent);
          // While in thoughtstream view, move relation into the same bundle as the sibling below
          if (parent.id === graphStore.thoughtstreamRoot.id) {
            const siblingBelowBundle = graphStore.relationToBundles.get(siblingBelow.object.id)?.[0];
            const thisBundle = graphStore.relationToBundles.get(relation.id)?.[0];
            if (siblingBelowBundle && thisBundle?.id !== siblingBelowBundle?.id) {
              if (thisBundle) {
                graphStore.removeFromBundle(relation, thisBundle);
              }
              graphStore.addToBundle(relation, siblingBelowBundle);
            }
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, graphStore, parent, relation, siblingAbove, siblingBelow]);

  return null;
};
