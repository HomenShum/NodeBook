import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $createRangeSelection, $getRoot, $setSelection, COMMAND_PRIORITY_LOW, createCommand } from "lexical";
import { useEffect } from "react";

export const JUMP_TO_START = createCommand("JUMP_TO_START");
export const JUMP_TO_END = createCommand("JUMP_TO_END");

export const JumpSelectionPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        JUMP_TO_START,
        () => {
          const selection = $createRangeSelection();
          // Newly created selection will be at start of editor by default
          $setSelection(selection);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        JUMP_TO_END,
        () => {
          const selection = $createRangeSelection();
          const lastNode = $getRoot().getLastDescendant();
          if (!lastNode) return false;
          selection.anchor.key = lastNode.getKey();
          selection.anchor.offset = lastNode.getTextContentSize();
          $setSelection(selection);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
};
