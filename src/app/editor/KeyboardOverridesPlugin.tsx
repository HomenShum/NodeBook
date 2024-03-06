import { useContext, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
} from "lexical";
import { EditorContext } from "./Editor";
import { OutlineViewStoreContext } from "../store/outline";
import { GraphStoreContext } from "../store/graph";
import { Bullet } from "../model/OutlineBullet";

const getEdiitorPosition = (event: KeyboardEvent) => {
  const target = event?.target as HTMLElement;
  const allEditors = Array.from(
    document.querySelectorAll('div[contenteditable="true"]')
  );
  const curInex = allEditors.indexOf(target);
  return curInex;
};

const focusEditor = (index: number) => {
  const allEditors = Array.from(
    document.querySelectorAll('div[contenteditable="true"]')
  );
  const editor = allEditors[index] as HTMLElement;
  if (editor) {
    editor.focus();
  }
};

const focusNextEditor = (event: KeyboardEvent) => {
  const curPosition = getEdiitorPosition(event);
  focusEditor(curPosition + 1);
};

const focusPrevEditor = (event: KeyboardEvent) => {
  const curPosition = getEdiitorPosition(event);
  focusEditor(curPosition - 1);
};

interface Props {
  bullet: Bullet;
  context: EditorContext;
}

export const KeyboardOverridesPlugin = ({ bullet, context }: Props) => {
  const graphStore = useContext(GraphStoreContext);
  const outlineViewStore = useContext(OutlineViewStoreContext);
  const [editor] = useLexicalComposerContext();
  const node = bullet.graphNode;
  useEffect(() => {
    const { siblingAbove } = context;
    const removeListener = mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event || !graphStore) return false;
          event.preventDefault();
          if (!bullet.parent) {
            console.log("Parent not found");
            return false;
          }
          const newBullet = bullet.parent.createChild();
          outlineViewStore.setFocusedNode(newBullet);
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
            const grandparent = bullet.parent?.parent;
            if (!grandparent) {
              console.log("Can't shift tab because no grandparent to move to");
              return false;
            }
            outlineViewStore.updateNodeToParent(bullet, grandparent);
            return true;
          } else {
            if (!siblingAbove) {
              console.log("Sibling not found");
              return false;
            }
            if (!bullet.parent) {
              console.log("Parent not found");
              return false;
            }
            outlineViewStore.updateNodeToParent(bullet, siblingAbove);
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
            if (bullet.parent) {
              bullet.delete();
              if (siblingAbove) {
                outlineViewStore.setFocusedNode(siblingAbove);
              } else if (bullet.parent) {
                outlineViewStore.setFocusedNode(bullet.parent);
              } else {
                outlineViewStore.setFocusedNode(null);
              }
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          event.preventDefault();
          focusNextEditor(event);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          event.preventDefault();
          focusPrevEditor(event);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
    return removeListener;
  }, [editor, graphStore, outlineViewStore, node, bullet, context]);
  return null;
};
