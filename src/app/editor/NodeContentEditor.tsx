import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { cn } from "@/lib/utils";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { useRelationAtPath } from "../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../controller/useViewController";
import { GraphNode } from "../model/GraphNode";
import { MentionNode } from "../model/MentionNode";
import styles from "./Editor.module.css";
import { KeyboardOverridesPlugin } from "./plugins/KeyboardOverridesPlugin";
import { MentionPlugin } from "./plugins/MentionPlugin";
import { RelationPlugin } from "./plugins/RelationPlugin";
import { SyncWithGraphPlugin } from "./plugins/SyncWithGraphPlugin";
import { ViewControllerRegistryPlugin } from "./plugins/ViewControllerRegistryPlugin";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

export const NodeContentEditor = observer(() => {
  const view = useViewController();
  const { object: node, pathToNodeStr } = useRelationAtPath();
  if (!(node instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [MentionNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(node.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
    },
  };

  return (
    <div className={cn(styles.EditorWrapper, view.showAtSignOnMention && styles.showAtSignPrefix)}>
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className="outline-none" data-nodeid={node.id} />}
          placeholder={null}
        />
        <HistoryPlugin />
        <ClearEditorPlugin />
        <SyncWithGraphPlugin node={node} />
        <KeyboardOverridesPlugin />
        <RelationPlugin />
        <MentionPlugin />
        <ViewControllerRegistryPlugin pathToNodeStr={pathToNodeStr} />
      </LexicalComposer>
    </div>
  );
});
