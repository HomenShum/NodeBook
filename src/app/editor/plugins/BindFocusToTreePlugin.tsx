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
    // Update the editor focus to match the tree selection
    const disposeAutorun = autorun(() => {
      const editorFocused = editor.getRootElement()?.contains(document.activeElement);
      const sel = tree.selection;

      switch (sel?.type) {
        case "node": {
          if(editorFocused){
            editor.blur();
          }
          break;
        }
        case "editor": {
          if(tree.isNodeFocused(treeNode.id)){
            editor.update(() => {
              editor.focus(undefined, {
                defaultSelection: sel.position === "start" ?
                  "rootStart" : sel.position === "end"
                    ? "rootEnd" : undefined
              });
            })
          } else {
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
          if (tree.isNodeFocused(treeNode.id)) {
            tree.setFocusedNode(null);
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          let position: EditorSelectionPosition = "end";
          const startEndPoints = editor.getEditorState()._selection?.getStartEndPoints();
          if(Array.isArray(startEndPoints) && startEndPoints[0].offset === 0 && startEndPoints[1].offset === 0){
            position = "start";
          }
          tree.setFocusedNode(treeNode.id, position);
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
