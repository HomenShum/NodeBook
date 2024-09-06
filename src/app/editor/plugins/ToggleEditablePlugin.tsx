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

import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { checkForMentionMatch, checkForSearchAndReplaceMatch } from "@/lib/utils";

type ToggleEditablePluginProps = {
  treeNode: DescendantTreeNode;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
};

export const ToggleEditablePlugin = ({ treeNode, isEditMode, setIsEditMode }: ToggleEditablePluginProps) => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { searchAndReplaceDropdown } = useSettingsStore();

  useEffect(() => {
    if (!editor) return;

    const editable = treeNode.object.authorId === graphStore.user.id && (treeNode.object.isLocal || isEditMode);
    editor.setEditable(editable);

    if (!treeNode.object.isLocal && isEditMode) {
      const commandHandler = (e: Event) => {
        e.stopPropagation();
        editor.blur();
        setIsEditMode(false);
        return true;
      };

      const commandHandlerForEnterKey = (e: Event) => {
        // Check if current text is opening a dropdown for mention or search & replace
        const relation = treeNode.relationWithParent
        const isLabellingRelation = relation?.isLabelled() ?? false;
        const mentionMatch = checkForMentionMatch(treeNode.object.text)
        const searchAndReplaceMatch = checkForSearchAndReplaceMatch(treeNode.object.text, isLabellingRelation, searchAndReplaceDropdown);

        if (mentionMatch || searchAndReplaceMatch) {
          return false; // Let DropdownMenu handle the Enter key on select option for mention or search & replace 
        }
        e.stopPropagation();
        editor.blur();
        setIsEditMode(false);
        return true;
      };

      return mergeRegister(
        editor.registerCommand(BLUR_COMMAND, commandHandler, COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(KEY_ESCAPE_COMMAND, commandHandler, COMMAND_PRIORITY_NORMAL),
        editor.registerCommand(KEY_ENTER_COMMAND, commandHandlerForEnterKey, COMMAND_PRIORITY_HIGH), // Higher than EnterKeyPlugin
      );
    }
  }, [editor, treeNode, isEditMode, setIsEditMode, searchAndReplaceDropdown, graphStore.user.id]);

  return null;
};
