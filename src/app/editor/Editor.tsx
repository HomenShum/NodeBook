import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  EditorState,
} from "lexical";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { KeyboardOverridesPlugin } from "./KeyboardOverridesPlugin";
import { ContentEditable } from "./ui/ContentEditable";

import styles from "./Editor.module.css";
import { useViewStore } from "../store/outline";
import { OnChangePlugin } from "./OnChangePlugin";
import { MentionPlugin } from "./MentionPlugin";
import { GraphNodeView } from "../model/GraphNodeView";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

export type EditorContext = {
  node: GraphNodeView;
  siblingAbove?: GraphNodeView;
  siblingBelow?: GraphNodeView;
};

interface Props {
  node: GraphNodeView;
  onChange: (newValue: string) => void;
  context: EditorContext;
}

export const Editor = ({ node, onChange, context }: Props) => {
  const outlineViewStore = useViewStore();
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(node.graphNode.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
      $getRoot().selectEnd();
    },
  };

  const editorOnChange = (editorState: EditorState) => {
    editorState.read(() => {
      const text = $getRoot().getTextContent();
      onChange(text);
    });
  };

  return (
    <div
      className={styles.EditorWrapper}
      onFocus={() => outlineViewStore.setFocusedNode(node)}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable key={node.id} nodeId={node.id} />}
          placeholder={null}
          // placeholder={<EditorPlaceholder />}
        />
        {node.isFocused && <AutoFocusPlugin />}
        <HistoryPlugin />
        <OnChangePlugin onChange={editorOnChange} />
        <KeyboardOverridesPlugin nodeView={node} context={context} />
        <MentionPlugin />
      </LexicalComposer>
    </div>
  );
};
