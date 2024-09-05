import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";

import { createConfig } from "@/app/editor/createConfig";
import { DropdownMenuPlugin } from "@/app/editor/plugins/DropdownMenuPlugin";
import { SyncWithGraphPlugin } from "@/app/editor/plugins/SyncWithGraphPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { RootTreeNode } from "@/app/tree/nodes";

import styles from "./Editor.module.css";

export const NodeHeaderEditor = observer(({ treeNode }: { treeNode: RootTreeNode }) => {
  const graphStore = useGraphStore();
  const editable = treeNode.object.authorId === graphStore.user.id;
  return (
    <div>
      <LexicalComposer initialConfig={createConfig({ namespace: "header-editor", treeNode, editable })}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
          placeholder={null}
        />
        <DropdownMenuPlugin treeNode={treeNode} />
        <ClearEditorPlugin />
        {treeNode.object instanceof GraphNode && editable && <SyncWithGraphPlugin node={treeNode.object} />}
      </LexicalComposer>
    </div>
  );
});
