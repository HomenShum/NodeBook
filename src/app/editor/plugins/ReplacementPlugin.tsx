import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
  ParagraphNode,
  SerializedParagraphNode,
  TextNode,
} from "lexical";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { nodeToChip } from "@/app/editor/utils/content";
import { GraphNode } from "@/app/graph/GraphNode";
import { BaseTreeNode } from "@/app/tree/nodes";
import { HASHTAG_SYMBOL, MENTION_SYMBOL } from "@/lib/utils";

const AT_HASH = MENTION_SYMBOL + HASHTAG_SYMBOL;

interface Props {
  // Explicit `null` because not passing it where needed would result in bugs
  treeNode: BaseTreeNode | null;
}

export const ReplacementPlugin = ({ treeNode }: Props) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== HASHTAG_SYMBOL || !settingsStore.atHashtagReplacement) return false;

        // If in an empty editor, we don't want to replace `#` with `@#`
        const paragraph = editor.getEditorState().toJSON().root.children[0] as SerializedParagraphNode;
        if (paragraph.children.length === 0) return false;

        event.preventDefault();
        editor.update(async () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          // Just type a `#` in place of the selected content if the selection spans multiple nodes
          if (selection.anchor.key !== selection.focus.key) return;

          const node = selection.anchor.getNode();
          const text = node.getTextContent();
          const selectedText = selection.getTextContent();
          const start = Math.min(selection.anchor.offset, selection.focus.offset);
          const end = Math.max(selection.anchor.offset, selection.focus.offset);
          const wHash = text.slice(0, start) + HASHTAG_SYMBOL + selectedText + text.slice(end);

          if (node instanceof TextNode) {
            const isGraphEditor = treeNode && treeNode.object instanceof GraphNode;

            // If we're inside a graph node editor, we need to upsert `#` for the undo/redo stack
            if (isGraphEditor) {
              const graphNode = treeNode.object;
              const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
              await graphStore.updateNode({
                nodeId: graphNode.id,
                nodeProps: {
                  content: paragraph.getChildren().map((n) => {
                    if (n === node) {
                      return { type: "text", value: wHash };
                    } else {
                      return nodeToChip(n);
                    }
                  }),
                },
              });
            }

            // After the async update above, we have to call `editor.update()` again
            editor.update(() => {
              const sel = $getSelection();
              if (!$isRangeSelection(sel)) return;

              const n = sel.anchor.getNode();
              if (n instanceof TextNode) {
                const wAtHash = text.slice(0, start) + AT_HASH + selectedText + text.slice(end);
                n.setTextContent(wAtHash);
                sel.anchor.offset = sel.focus.offset = end + 2;
                $setSelection(sel);
              }
            });
          }
        });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, settingsStore.atHashtagReplacement, treeNode]);

  return null;
};
