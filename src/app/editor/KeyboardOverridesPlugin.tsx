import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
} from "lexical";
import { useEffect } from "react";
import { GraphStore } from "../model/GraphStore";
import { Bullet } from "../model/OutlineBullet";
import { ViewStore } from "../model/ViewStore";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { EditorContext } from "./Editor";

interface Props {
  bullet: Bullet;
  context: EditorContext;
}

const makeBulletKeyCommands = (
  graphStore: GraphStore,
  viewStore: ViewStore,
  editor: LexicalEditor,
  bullet: Bullet,
  siblingAbove?: Bullet,
  siblingBelow?: Bullet,
) => {
  return mergeRegister(
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!event || !graphStore) return false;
        event.preventDefault();
        if (!bullet.parent) {
          console.log("Parent not found");
          return false;
        }
        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
        const newBullet = graphStore.splitBullet(bullet, selection);
        viewStore.setFocusedNode(newBullet);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (event.key === "@" && bullet.graphNode.text === "") {
          // When user types "@" at the beginning of a bullet, we set it to
          // replacing mode, where you can select a different node for the
          // bullet to represent.
          event.preventDefault();
          bullet.setReplacing(true);
          return true;
        } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowUp") {
          if (!siblingAbove) return false;
          // TODO: is this sketchy?
          event.preventDefault();
          siblingAbove.moveAfterSibling(bullet);
          return true;
        } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowDown") {
          if (!siblingBelow) return false;
          event.preventDefault();
          bullet.moveAfterSibling(siblingBelow);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!graphStore) return false;
        event.preventDefault();
        if (event.shiftKey) {
          const grandparent = bullet.parent?.parent;
          if (!grandparent) {
            console.log("Can't shift tab because no grandparent to move to");
            return false;
          }
          if (!bullet.parent) {
            console.log("Can't shift tab because no parent to move to");
            return false;
          }
          graphStore.moveBulletToNewParent({ parent: grandparent, target: bullet.parent, bullets: [bullet] });
          return true;
        } else {
          if (!siblingAbove || !(siblingAbove instanceof Bullet)) {
            console.log("Sibling not found");
            return false;
          }
          if (!bullet.parent) {
            console.log("Parent not found");
            return false;
          }
          graphStore.moveBulletToNewParent({ bullets: [bullet], parent: siblingAbove, target: "bottom" });
          if (!siblingAbove.isExpanded) {
            siblingAbove.toggleExpanded();
          }
          viewStore.setFocusedNode(bullet);
          return true;
        }
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        if (!graphStore) return false;
        event.preventDefault();
        if (bullet.graphNode.text === "") {
          if (bullet.parent) {
            bullet.delete();
            if (siblingAbove) {
              viewStore.setFocusedNode(siblingAbove);
            } else if (bullet.parent) {
              viewStore.setFocusedNode(bullet.parent);
            } else {
              viewStore.setFocusedNode(null);
            }
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event.preventDefault();
        viewStore.setFocusedNode(siblingBelow ?? null);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        viewStore.setFocusedNode(siblingAbove ?? null);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
};

export const KeyboardOverridesPlugin = ({ bullet, context }: Props) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const { siblingAbove, siblingBelow } = context;
    return makeBulletKeyCommands(graphStore, viewStore, editor, bullet, siblingAbove, siblingBelow);
  }, [editor, graphStore, viewStore, bullet, context]);
  return null;
};
