import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { $createParagraphNode, $createTextNode, $getRoot, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND } from "lexical";
import { useEffect } from "react";

import { Search } from "@/app/components/CommandBar/CommandBar";
import { CommandBarMentionDropdown } from "@/app/editor/plugins/dropdown/CommandBarMentionDropdown";
import { nodeToChip } from "@/app/editor/utils/content";
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
        e?.preventDefault();
        return true;
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
}

export const CmdEditor = ({ dropdownContainerRef, onChange }: Props) => {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "command-bar",
        theme: {},
        onError: (e: any) => console.error(e),
        nodes: [MentionNode],
        editorState: (editor) => {
          const paragraph = $createParagraphNode();
          const text = $createTextNode();
          paragraph.append(text);
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
    </LexicalComposer>
  );
};
