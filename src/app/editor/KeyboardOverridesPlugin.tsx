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
import { GraphNodeView } from "../model/GraphNodeView";
import { GraphStore } from "../model/GraphStore";
import { Bullet } from "../model/OutlineBullet";
import { OutlineViewStore } from "../model/OutlineViewStore";
import { Note } from "../model/ThoughtstreamNote";
import { ThoughtstreamViewStore } from "../model/ThoughtstreamViewStore";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { EditorContext } from "./Editor";

interface Props {
  nodeView: GraphNodeView;
  context: EditorContext;
}

const makeBulletKeyCommands = (
  graphStore: GraphStore,
  viewStore: OutlineViewStore,
  editor: LexicalEditor,
  bullet: Bullet,
  siblingAbove: Bullet,
  siblingBelow: Bullet,
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
        // Get text before and after the cursor
        const points = $getSelection()?.getStartEndPoints();
        if (!points) return false;
        const newBullet = viewStore.splitBullet(bullet, points[0].offset, points[1].offset);
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
          viewStore.moveBulletToNewParent({ parent: grandparent, target: bullet.parent }, bullet);
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
          viewStore.moveBulletToNewParent({ parent: siblingAbove }, bullet);
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
        viewStore.setFocusedNode(siblingBelow);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        viewStore.setFocusedNode(siblingAbove);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
};

const makeNoteKeyCommands = (
  graphStore: GraphStore,
  viewStore: ThoughtstreamViewStore,
  editor: LexicalEditor,
  note: Note,
  siblingAbove: Note,
  siblingBelow: Note,
) => {
  return mergeRegister(
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        if (!graphStore) return false;
        event.preventDefault();
        if (note.graphNode.text === "") {
          if (siblingAbove) {
            note.delete();
            viewStore.setFocusedNode(siblingAbove);
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
        viewStore.setFocusedNode(siblingBelow);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        viewStore.setFocusedNode(siblingAbove);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    // editor.registerCommand(
    //   KEY_DOWN_COMMAND,
    //   (event) => {
    //     const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
    //     if (metaOrCtrl && event.shiftKey && event.key === "ArrowUp") {
    //       if (!siblingAbove) return false;
    //       // TODO: is this sketchy?
    //       event.preventDefault();
    //       const pos = siblingAbove.position;
    //       siblingAbove.position = note.position;
    //       note.position = pos;
    //       return true;
    //     } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowDown") {
    //       if (!siblingBelow) return false;
    //       event.preventDefault();
    //       const pos = siblingBelow.position;
    //       siblingBelow.position = note.position;
    //       note.position = pos;
    //       return true;
    //     }
    //     return false;
    //   },
    //   COMMAND_PRIORITY_LOW,
    // ),
  );
};

export const KeyboardOverridesPlugin = ({ nodeView, context }: Props) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  const node = nodeView.graphNode;
  useEffect(() => {
    const { siblingAbove, siblingBelow } = context;
    switch (nodeView.type) {
      case "bullet":
        const bullet = nodeView as Bullet;
        return makeBulletKeyCommands(
          graphStore,
          viewStore.outlineViewStore,
          editor,
          bullet,
          siblingAbove as Bullet,
          siblingBelow as Bullet,
        );
      case "note":
        const note = nodeView as Note;
        return makeNoteKeyCommands(
          graphStore,
          viewStore.thoughtstreamViewStore,
          editor,
          note,
          siblingAbove as Note,
          siblingBelow as Note,
        );
    }
  }, [editor, graphStore, viewStore, node, nodeView, context]);
  return null;
};
