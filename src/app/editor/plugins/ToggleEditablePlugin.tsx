import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";

type ToggleEditablePluginProps = {
  treeNode: DescendantTreeNode;
  isEditable: boolean;
  setIsEditable: (isEditable: boolean) => void;
};

export const ToggleEditablePlugin = ({ treeNode, isEditable, setIsEditable }: ToggleEditablePluginProps) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(isEditable || treeNode.object.isLocal); // Local nodes are always editable

    if (!treeNode.object.isLocal && isEditable) {
      const commandHandler = (e: Event) => {
        e.stopPropagation();
        editor.blur();
        setIsEditable(false);
        return true;
      };

      return mergeRegister(
        editor.registerCommand(BLUR_COMMAND, commandHandler, COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(KEY_ESCAPE_COMMAND, commandHandler, COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(KEY_ENTER_COMMAND, commandHandler, COMMAND_PRIORITY_HIGH), // Higher than EnterKeyPlugin
      );
    }
  }, [editor, treeNode, isEditable, setIsEditable]);

  return null;
};
