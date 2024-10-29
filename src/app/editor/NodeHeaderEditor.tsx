import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";

import { useUser } from "@/app/contexts/UserContext";
import { createConfig } from "@/app/editor/createConfig";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { useClickableMention } from "@/app/editor/utils/useClickableMention";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { RootTreeNode } from "@/app/tree/nodes";

import { IgnoreModShiftAPlugin } from "@/app/editor/plugins/IgnoreModShiftAPlugin";
import styles from "./Editor.module.css";

interface Props {
  treeNode: RootTreeNode;
}

export const NodeHeaderEditor = observer(function NodeHeaderEditor({ treeNode }: Props) {
  const user = useUser();

  const editable = !user.isAnonymous && treeNode.object instanceof GraphNode;
  const handleMentionNodeClick = useClickableMention(treeNode);

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
          placeholder={<span className={styles.PlaceholderTitle}>Add title</span>}
        />
        <DropdownPlugin treeNode={treeNode} />
        <EnterKeyPlugin treeNode={treeNode} />
        <IgnoreModShiftAPlugin />
        <ClearEditorPlugin />
        <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
        {treeNode.object instanceof GraphNode && (
          <SyncWithModelsPlugin node={treeNode.object} treeNodeId={treeNode.id} />
        )}
      </LexicalComposer>
    </div>
  );
});
