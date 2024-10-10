import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";

import { useUser } from "@/app/contexts/UserContext";
import { createConfig } from "@/app/editor/createConfig";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { RootTreeNode } from "@/app/tree/nodes";

import styles from "./Editor.module.css";

interface Props {
  treeNode: RootTreeNode;
}

export const NodeHeaderEditor = observer(function NodeHeaderEditor({ treeNode }: Props) {
  const user = useUser();

  const editable = !user.isAnonymous && treeNode.object instanceof GraphNode;

  return (
    <div>
      <LexicalComposer
        initialConfig={createConfig({
          namespace: "header-editor",
          treeNode,
          editable,
        })}
      >
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
          placeholder={<div className={styles.Placeholder}>Add title</div>}
        />
        <DropdownPlugin treeNode={treeNode} />
        <ClearEditorPlugin />
        {treeNode.object instanceof GraphNode && (
          <SyncWithModelsPlugin node={treeNode.object} treeNodeId={treeNode.id} />
        )}
      </LexicalComposer>
    </div>
  );
});
