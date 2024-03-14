import { useContext, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
} from "lexical";
import { EditorContext } from "./Editor";
import { ViewStoreContext } from "../store/outline";
import { GraphStoreContext } from "../store/graph";
import { Bullet } from "../model/OutlineBullet";
import { GraphNodeView } from "../model/GraphNodeView";
import { ViewStore } from "../model/ViewStore";
import { GraphStore } from "../model/GraphStore";
import { Note } from "../model/ThoughtstreamNote";

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
  nodeView: GraphNodeView;
  context: EditorContext;
}

const makeBulletKeyCommands = (
  graphStore: GraphStore,
  viewStore: ViewStore,
  editor: LexicalEditor,
  bullet: Bullet,
  siblingAbove: Bullet
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
        const newBullet = bullet.parent.createChild();
        viewStore.setFocusedNode(newBullet);
        return true;
      },
      COMMAND_PRIORITY_LOW
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
          viewStore.updateNodeToParent(bullet, grandparent);
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
          viewStore.updateNodeToParent(bullet, siblingAbove);
          if (!siblingAbove.isExpanded) {
            siblingAbove.toggleExpanded();
          }
          return true;
        }
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        if (!graphStore) return false;
        event?.preventDefault();
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
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event.preventDefault();
        focusNextEditor(event);
        return true;
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        focusPrevEditor(event);
        return true;
      },
      COMMAND_PRIORITY_LOW
    )
  );
};

const makeNoteKeyCommands = (
  graphStore: GraphStore,
  viewStore: ViewStore,
  editor: LexicalEditor,
  note: Note
) => {
  return mergeRegister(
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event.preventDefault();
        focusNextEditor(event);
        return true;
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        focusPrevEditor(event);
        return true;
      },
      COMMAND_PRIORITY_LOW
    )
  );
};

export const KeyboardOverridesPlugin = ({ nodeView, context }: Props) => {
  const graphStore = useContext(GraphStoreContext);
  const viewStore = useContext(ViewStoreContext);
  const [editor] = useLexicalComposerContext();
  const node = nodeView.graphNode;
  useEffect(() => {
    const { siblingAbove } = context;
    switch (nodeView.type) {
      case "bullet":
        const bullet = nodeView as Bullet;
        return makeBulletKeyCommands(
          graphStore,
          viewStore,
          editor,
          bullet,
          siblingAbove as Bullet
        );
      case "note":
        const note = nodeView as Note;
        return makeNoteKeyCommands(graphStore, viewStore, editor, note);
    }
  }, [editor, graphStore, viewStore, node, nodeView, context]);
  return null;
};
