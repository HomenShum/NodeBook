import { useContext, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
} from "lexical";
import { EditorContext } from "./Editor";
import { Bullet } from "../model/OutlineViewStore";
import { OutlineViewStoreContext } from "../store/outline";
import { GraphStoreContext } from "../store/graph";

export const KeyboardOverridesPlugin = ({
  treeNode,
  context: { parents, siblingAbove },
}: {
  treeNode: Bullet;
  context: EditorContext;
}) => {
  const graphStore = useContext(GraphStoreContext);
  const treeViewStore = useContext(OutlineViewStoreContext);
  const [editor] = useLexicalComposerContext();
  const node = treeNode.graphNode;
  useEffect(() => {
    const removeListener = mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!graphStore) return false;
          event?.preventDefault();
          if (!treeNode.parent) {
            console.log("Parent not found");
            return false;
          }
          const newTreeNode = treeNode.parent.createChild();
          treeViewStore.setFocusedNode(newTreeNode);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (!graphStore) return false;
          event?.preventDefault();
          if (event.shiftKey) {
            const grandparent = treeNode.parent?.parent;
            if (!grandparent) {
              console.log("Can't shift tab because no grandparent to move to");
              return false;
            }
            treeViewStore.updateNodeToParent(treeNode, grandparent);
            return true;
          } else {
            if (!siblingAbove) {
              console.log("Sibling not found");
              return false;
            }
            if (!treeNode.parent) {
              console.log("Parent not found");
              return false;
            }
            treeViewStore.updateNodeToParent(treeNode, siblingAbove);
            if (!siblingAbove.isExpanded) {
              siblingAbove.toggleExpanded();
            }
            return true;
          }
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!graphStore) return false;
          event?.preventDefault();
          if (node.text === "") {
            if (treeNode.parent) {
              treeNode.delete();
              if (siblingAbove) {
                treeViewStore.setFocusedNode(siblingAbove);
              } else if (treeNode.parent) {
                treeViewStore.setFocusedNode(treeNode.parent);
              } else {
                treeViewStore.setFocusedNode(null);
              }
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
    return removeListener;
  }, [editor, graphStore, node, parents, siblingAbove, treeNode, treeViewStore]);
  return null;
};
