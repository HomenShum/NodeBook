import { $createParagraphNode, $createTextNode, $getRoot, $setSelection, EditorState } from "lexical";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { KeyboardOverridesPlugin } from "./KeyboardOverridesPlugin";
import { ContentEditable } from "./ui/ContentEditable";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect } from "react";
import { GraphNodeView } from "../model/GraphNodeView";
import { useViewStore } from "../store/outline";
import styles from "./Editor.module.css";
import { MentionPlugin } from "./MentionPlugin";
import { OnChangePlugin } from "./OnChangePlugin";

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

export const Editor = ({ node, context }: Props) => {
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

  return (
    <div className={styles.EditorWrapper} onFocus={() => outlineViewStore.setFocusedNode(node)}>
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable key={node.id} nodeId={node.id} />}
          placeholder={null}
          // placeholder={<EditorPlaceholder />}
        />
        {node.isFocused && <AutoFocusPlugin />}
        <HistoryPlugin />
        <SyncEditorAndGraphNode node={node} />
        <KeyboardOverridesPlugin nodeView={node} context={context} />
        <MentionPlugin />
      </LexicalComposer>
    </div>
  );
};

/**
 * This component is responsible for keeping the Lexical editor state in sync
 * with the graph node state. It listens for changes in the editor state and
 * updates the graph node accordingly. It also listens for changes in the graph
 * node state and updates the editor accordingly. It only applies a change if
 * the new state is different from the current state, to avoid infinite loops.
 *
 * (TODO: This way of avoiding infinite loops feels a bit sketchy, but it works
 * for now)
 */
const SyncEditorAndGraphNode = observer(({ node }: { node: GraphNodeView }) => {
  const [editor] = useLexicalComposerContext();

  const setGraphNodeTextToEditorState = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const text = $getRoot().getTextContent();
        if (text === node.graphNode.text) return;
        node.graphNode.setText(text);
      });
    },
    [node],
  );

  const setEditorToGraphNodeText = useCallback(
    (text: string) => {
      editor.update(() => {
        const currentParagraph = $getRoot().getChildren()[0];
        if (currentParagraph.getTextContent() === text) return;
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        currentParagraph.replace(paragraph);
        /**
         * Setting the selection to null here seems to prevent the error below.
         * Based on https://stackoverflow.com/a/72197580, it seems that when we're
         * updating the editor state on a non-focused editor, a new selection is
         * automatically set in the new editor state, and then the editor takes
         * the dom selection away from the user, leading to other downstream issues.
         *
         * ```
         * Error: updateEditor: selection has been lost because the previously
         * selected nodes have been removed and selection wasn't moved to
         * another node. Ensure selection changes after removing/replacing a
         * selected node.
         * ```
         */
        $setSelection(null);
      });
    },
    [editor],
  );

  useEffect(() => {
    setEditorToGraphNodeText(node.graphNode.text);
  }, [setEditorToGraphNodeText, node.graphNode.text]);
  return <OnChangePlugin onChange={setGraphNodeTextToEditorState} />;
});
