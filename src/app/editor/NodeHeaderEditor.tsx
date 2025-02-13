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
import { IgnoreModShiftAPlugin } from "@/app/editor/plugins/IgnoreModShiftAPlugin";
import { LinkPlugin } from "@/app/editor/plugins/LinkPlugin";
import { ReplacementPlugin } from "@/app/editor/plugins/ReplacementPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { TodoPlugin } from "@/app/editor/plugins/TodoPlugin";
import { useClickableMention } from "@/app/editor/utils/useClickableMention";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";

import styles from "./Editor.module.css";

interface Props {
  treeNode: RootTreeNode | DescendantTreeNode;
  noteTitle?: string;
}

export const NodeHeaderEditor = observer(function NodeHeaderEditor({ treeNode, noteTitle }: Props) {
  const user = useUser();

  const editable = !user.isAnonymous && treeNode.object instanceof GraphNode && !treeNode.object.isEditRestricted;
  const handleMentionNodeClick = useClickableMention(treeNode);
  const isNote = treeNode.object.noteContentRelationsList.size > 0;

  return (
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
        placeholder={
          <span className={styles.PlaceholderTitle}>
            {isNote ? <em style={{ marginRight: 3 }}>Multiline Note - Untitled</em> : "Untitled"}
          </span>
        }
      />
      <DropdownPlugin treeNode={treeNode} />
      <EnterKeyPlugin treeNode={treeNode} />
      <IgnoreModShiftAPlugin />
      <TodoPlugin treeNode={treeNode} />
      <ReplacementPlugin treeNode={treeNode} />
      <ClearEditorPlugin />
      <LinkPlugin />
      <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
      {treeNode.object instanceof GraphNode && <SyncWithModelsPlugin node={treeNode.object} treeNode={treeNode} />}
    </LexicalComposer>
  );
});
