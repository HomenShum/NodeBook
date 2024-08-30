import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
import { action, autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useTree } from "@/app/tree/TreeContext";
import { EditorSelectionPosition } from "@/app/tree/selection";

export const BindFocusToTreePlugin = observer(() => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();

  useEffect(() => {
    function isEditorFocused() {
      return editor.getRootElement()?.contains(document.activeElement);
    }

    // Update the editor focus to match the tree selection
    const disposeAutorun = autorun(() => {
      const sel = tree.selection;

      switch (sel?.type) {
        case "node": {
          if (isEditorFocused()) {
            // When the selection switches to node type, blur all editors
            editor.blur();
          }
          break;
        }
        case "editor": {
          if (!isEditorFocused() && sel.treeNodeId === treeNode.id) {
            // Editor isn't focused but should be -> focus it
            editor.focus(undefined, {
              defaultSelection: sel.position === "start" ? "rootStart" : sel.position === "end" ? "rootEnd" : undefined,
            });
          } else if (isEditorFocused() && sel.treeNodeId !== treeNode.id) {
            // Editor is focused but shouldn't be -> blur it
            editor.blur();
          }
        }
      }
    });

    // Update the tree selection to match the editor focus
    const disposeCommands = mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        action(() => {
          if (isEditorFocused() && tree.isNodeFocused(treeNode.id)) {
            // Editor is blurring while node is focused -> set tree selection to null
            tree.setFocusedNode(null);
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          if (!isEditorFocused() && !tree.isNodeFocused(treeNode.id)) {
            // Editor is becoming focused but node isn't focused -> set tree selection to this node

            //`setFocusedNode` has a optional position param that defaults to "end",
            // now because of that the editor and the Tree get in an inconsistent state,
            // If we call setFocusedNode(newNodePath, "start") from anywhere, it triggers
            // the editor focus (in the autorun above) but then that focus dispatches
            // this FOCUS_COMMAND without a position, which defaults to end, but since we set
            // selection position to `true` initially, it triggers the autorun again).
            // Hence we "compute" the position from the editorState and pass it to
            // `setFocusedNode` here.
            let position: EditorSelectionPosition = "end";
            const startEndPoints = editor.getEditorState()._selection?.getStartEndPoints();
            if (Array.isArray(startEndPoints) && startEndPoints[0].offset === 0 && startEndPoints[1].offset === 0) {
              position = "start";
            }
            tree.setFocusedNode(treeNode.id, position);
            return true;
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
    return () => {
      disposeAutorun();
      disposeCommands();
    };
  }, [editor, tree, treeNode.id]);

  return null;
});
