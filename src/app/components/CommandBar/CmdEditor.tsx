import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  TextNode,
} from "lexical";
import { useEffect } from "react";

import { Search } from "@/app/components/CommandBar/CommandBar";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { CommandBarMentionDropdown } from "@/app/editor/plugins/dropdown/CommandBarMentionDropdown";
import { ReplacementPlugin } from "@/app/editor/plugins/ReplacementPlugin";
import { getChipToNodeFn, nodeToChip } from "@/app/editor/utils/content";
import { MentionNode } from "@/app/graph/MentionNode";

import styles from "./CommandBar.module.css";

function OnChangePlugin({ onChange }: { onChange: (search: Search) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        onChange({
          text: root.getTextContent(),
          chips: root.getAllTextNodes().map(nodeToChip),
        });
      });
    });
  }, [editor, onChange]);
  return null;
}

function PreventEnterPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e) => {
        if (!e) return false;
        if (e.shiftKey) {
          // On shift+enter, allow the editor to handle it and create a new line,
          // and prevent the command bar from selecting an option.
          e.stopPropagation();
          return false;
        } else {
          // But on normal enter, prevent default so the editor *doesn't* handle
          // it (which would prevent the command bar from handling it).
          e?.preventDefault();
          return true;
        }
      },
      // Low priority so it doesn't prevent the mention dropdown enter handling
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}

interface Props {
  dropdownContainerRef: React.RefObject<HTMLDivElement>;
  onChange: (search: Search) => void;
  initialValue?: Search;
}

export const CmdEditor = ({ dropdownContainerRef, onChange, initialValue }: Props) => {
  const graphStore = useGraphStore();
  const chipToNode = getChipToNodeFn(graphStore);

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "command-bar",
        theme: {},
        onError: (e: any) => console.error(e),
        nodes: [MentionNode],
        editorState: (editor) => {
          const paragraph = $createParagraphNode();
          if (initialValue && initialValue.chips.length > 0) {
            initialValue.chips.forEach((chip) => {
              const node = chipToNode(chip);
              paragraph.append(node);
            });

            // Select the entire contents
            const fullSelection = $createRangeSelection();
            const firstChild = paragraph.getFirstChild() as TextNode;
            const lastChild = paragraph.getLastChild() as TextNode;
            fullSelection.anchor.set(firstChild.getKey(), 0, "text");
            fullSelection.focus.set(lastChild.getKey(), lastChild.getTextContent().length, "text");
            $setSelection(fullSelection);
          } else {
            const text = $createTextNode();
            paragraph.append(text);
          }
          $getRoot().append(paragraph);
          setTimeout(() => editor?.focus(), 0);
        },
        editable: true,
      }}
    >
      <PlainTextPlugin
        ErrorBoundary={LexicalErrorBoundary}
        contentEditable={<ContentEditable className={styles.Input} suppressContentEditableWarning />}
      />
      <OnChangePlugin onChange={onChange} />
      <CommandBarMentionDropdown dropdownContainerRef={dropdownContainerRef} />
      <PreventEnterPlugin />
      <ReplacementPlugin treeNode={null} />
    </LexicalComposer>
  );
};
