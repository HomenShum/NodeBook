import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { RefObject, useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { createConfig } from "@/app/editor/createConfig";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { LeftRightArrowAtEndsPlugin } from "@/app/editor/plugins/LeftRightArrowAtEndsPlugin";
import { LinkPlugin } from "@/app/editor/plugins/LinkPlugin";
import { PastePlugin } from "@/app/editor/plugins/pastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { useSetRoot } from "@/app/tree/utils";

import styles from "./Editor.module.css";

interface Props {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
  boundaryRef: RefObject<HTMLDivElement>;
}

export const NodeEditor = observer(function NodeEditor({ treeNode, isEditorEditable, boundaryRef }: Props) {
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();
  const tree = useTree();

  const handleMentionNodeClick = useCallback(
    (e: Event) => {
      const nodeId = (e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!;
      e.stopPropagation();
      const node = graphStore.getNode(nodeId);
      if (node) {
        setRoot(node.getPath());
      }
    },
    [graphStore, setRoot],
  );

  return (
    <div className={styles.EditorWrapper}>
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
        <LinkPlugin nodeId={treeNode.object.id} />
        <SyncWithModelsPlugin node={treeNode.object} treeNodeId={treeNode.id} />
        {isEditorEditable && <ClearEditorPlugin />}
        {isEditorEditable && <EnterKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && tree.isNodeFocused(treeNode.id) && <DropdownPlugin treeNode={treeNode} />}
        {isEditorEditable && <LeftRightArrowAtEndsPlugin />}
        {isEditorEditable && <BackspaceMergeNodesPlugin />}
        {isEditorEditable && <PastePlugin />}
        {isEditorEditable && <RelationPlugin />}
        <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
        <ViewControllerRegistryPlugin pathToNodeStr={treeNode.path} />
        <ToggleEditablePlugin treeNode={treeNode} editable={isEditorEditable} />
      </LexicalComposer>
    </div>
  );
});
