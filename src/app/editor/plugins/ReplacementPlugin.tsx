import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
  ParagraphNode,
  TextNode,
} from "lexical";
import { useEffect } from "react";

import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { HASHTAG_SYMBOL, MENTION_SYMBOL } from "@/lib/utils";

const AT_HASH = MENTION_SYMBOL + HASHTAG_SYMBOL;

export const ReplacementPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const settingsStore = useSettingsStore();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== HASHTAG_SYMBOL || !settingsStore.atHashtagReplacement) return false;

        event.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const node = selection.anchor.getNode();
          const text = node.getTextContent();
          if (node instanceof TextNode) {
            node.setTextContent(text.slice(0, selection.anchor.offset) + AT_HASH + text.slice(selection.anchor.offset));
            selection.anchor.offset = selection.focus.offset = selection.anchor.offset + 2;
            $setSelection(selection);
          } else if (node instanceof ParagraphNode) {
            const textNode = $createTextNode("@#");
            node.append(textNode);
            textNode.selectEnd();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
};
