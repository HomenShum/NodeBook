import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { RefObject } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { ArrowKeyPlugin } from "@/app/editor/plugins/ArrowKeyPlugin";
import { AtKeyPlugin } from "@/app/editor/plugins/AtKeyPlugin";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { IgnoreModShiftAPlugin } from "@/app/editor/plugins/IgnoreModShiftAPlugin";
import { LinkPlugin } from "@/app/editor/plugins/LinkPlugin";
import { MinusKeyPlugin } from "@/app/editor/plugins/MinusKeyPlugin";
import { PastePlugin } from "@/app/editor/plugins/PastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { ReplacementPlugin } from "@/app/editor/plugins/ReplacementPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { TodoPlugin } from "@/app/editor/plugins/TodoPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { useClickableMention } from "@/app/editor/utils/useClickableMention";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { WordBreakPlugin } from "@/app/editor/plugins/WordBreakPlugin";

import styles from "./Editor.module.css";

interface Props {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
  editorRef: RefObject<HTMLDivElement>;
}

export const NodeEditor = observer(function NodeEditor({ treeNode, isEditorEditable, editorRef }: Props) {
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }

  const tree = treeNode.tree;
  const handleMentionNodeClick = useClickableMention(treeNode);

  return (
    <div className={styles.EditorWrapper} ref={editorRef}>
      <LexicalComposer
        initialConfig={createConfig({ namespace: "descendant-editor", treeNode, editable: isEditorEditable })}
      >
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={
            <ContentEditable
              className={`${styles.ContentEditable}`}
              data-nodeid={treeNode.object.id}
              suppressContentEditableWarning
            />
          }
          placeholder={<span className={styles.PlaceholderNode}>Start writing...</span>}
        />
        <SyncWithModelsPlugin node={treeNode.object} treeNode={treeNode} />
        {isEditorEditable && <WordBreakPlugin />}
        {isEditorEditable && <LinkPlugin />}
        {isEditorEditable && <ReplacementPlugin treeNode={treeNode} />}
        {isEditorEditable && <ClearEditorPlugin />}
        {isEditorEditable && <EnterKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && <MinusKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && tree.isNodeFocused(treeNode.id) && <DropdownPlugin treeNode={treeNode} />}
        {isEditorEditable && <ArrowKeyPlugin />}
        {isEditorEditable && <TodoPlugin treeNode={treeNode} />}
        {isEditorEditable && <BackspaceMergeNodesPlugin />}
        {isEditorEditable && <PastePlugin />}
        {isEditorEditable && <RelationPlugin />}
        {isEditorEditable && <IgnoreModShiftAPlugin />}
        {isEditorEditable && <AtKeyPlugin treeNode={treeNode} />}
        <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
        <ViewControllerRegistryPlugin treeNode={treeNode} />
        <ToggleEditablePlugin treeNode={treeNode} editable={isEditorEditable} />
      </LexicalComposer>
    </div>
  );
});
