import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useSettingsStore } from "@/app/graph/useSettingsStore";

export const ReplaceObjectPlugin = () => {
  const settingsStore = useSettingsStore();
  const [editor] = useLexicalComposerContext();
  const { treeNode, setViewType } = useTreeNode();
  const object = treeNode.object;
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) return false;
        if (event.key === "@" && object.text === "") {
          if (settingsStore.atSignTriggerToReplaceObject) {
            // When user types "@" at the beginning of a bullet, we set it to
            // replacing mode, where you can select a different node for the
            // bullet to represent.
            event.preventDefault();
            setViewType("replace");
            return true;
          }
        } else if (event.key === ";" && object.text === "") {
          if (settingsStore.semicolonTriggerToReplaceObject) {
            // When user types ";" at the beginning of a bullet, we set it to
            // replacing mode, where you can select a different node for the
            // bullet to represent.
            event.preventDefault();
            setViewType("replace");
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    object.text,
    setViewType,
    settingsStore.atSignTriggerToReplaceObject,
    settingsStore.semicolonTriggerToReplaceObject,
  ]);

  return null;
};
