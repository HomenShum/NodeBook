import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getRoot, COMMAND_PRIORITY_NORMAL, createCommand } from "lexical";
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
          $getRoot().getFirstDescendant()?.selectStart();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        JUMP_TO_END,
        () => {
          $getRoot().getLastDescendant()?.selectEnd();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [editor]);

  return null;
};
