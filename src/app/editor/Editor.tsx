import { useEffect } from "react";
import { $createParagraphNode, $createTextNode, $getRoot, EditorState } from "lexical";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { KeyboardOverridesPlugin } from "./KeyboardOverridesPlugin";
import { ContentEditable } from "./ui/ContentEditable";

import styles from "./Editor.module.css";
import { Bullet } from "../model/OutlineViewStore";
import { useOutlineViewStore } from "../store/outline";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

const OnChangePlugin = ({ onChange }: { onChange: (newState: EditorState) => void }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const unsubscribe = editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });
    return unsubscribe;
  }, [editor, onChange]);
  return null;
};

export type EditorContext = {
  node: Bullet;
  parents: Bullet[];
  siblingAbove?: Bullet;
  siblingBelow?: Bullet;
};

interface Props {
  node: Bullet;
  onChange: (newValue: string) => void;
  context: EditorContext;
}

export const Editor = ({ node, onChange, context }: Props) => {
  const treeViewStore = useOutlineViewStore();
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
    <div className={styles.EditorWrapper} onFocus={() => treeViewStore.setFocusedNode(node)}>
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
        <KeyboardOverridesPlugin treeNode={node} context={context} />
      </LexicalComposer>
    </div>
  );
};
