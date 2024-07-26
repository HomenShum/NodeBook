import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";

import { createConfig } from "@/app/editor/createConfig";
import { MentionPlugin } from "@/app/editor/plugins/MentionPlugin";
import { SyncWithGraphPlugin } from "@/app/editor/plugins/SyncWithGraphPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { RootTreeNode } from "@/app/tree/nodes";

import styles from "./Editor.module.css";

export const NodeHeaderEditor = observer(({ treeNode }: { treeNode: RootTreeNode }) => {
  return (
    <div>
      <LexicalComposer initialConfig={createConfig({ namespace: "header-editor", treeNode })}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
          placeholder={null}
        />
        <HistoryPlugin />
        <ClearEditorPlugin />
        {treeNode.object instanceof GraphNode && <SyncWithGraphPlugin node={treeNode.object} />}
        <MentionPlugin treeNode={treeNode} />
      </LexicalComposer>
    </div>
  );
});
