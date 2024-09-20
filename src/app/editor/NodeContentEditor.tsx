import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { RefObject } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { BindFocusToTreePlugin } from "@/app/editor/plugins/BindFocusToTreePlugin";
import { DropdownMenuPlugin } from "@/app/editor/plugins/DropdownMenuPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { LeftRightArrowAtEndsPlugin } from "@/app/editor/plugins/LeftRightArrowAtEndsPlugin";
import { PastePlugin } from "@/app/editor/plugins/pastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { createRouteUrl } from "@/app/util";
import { cn } from "@/lib/utils";

import { SyncWithGraphPlugin } from "./plugins/SyncWithGraphPlugin";

import styles from "./Editor.module.css";

export const NodeEditor = observer(
  ({
    treeNode,
    isEditorEditable,
    boundaryRef,
  }: {
    treeNode: DescendantTreeNode;
    isEditorEditable: boolean;
    boundaryRef: RefObject<HTMLDivElement>;
  }) => {
    if (!(treeNode.object instanceof GraphNode)) {
      throw new Error("Expected object to be a GraphNode");
    }
    const graphStore = useGraphStore();
    const router = useRouter();
    const tree = useTree();

    return (
      <div className={cn(styles.EditorWrapper, styles.showAtSignPrefix)}>
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
            placeholder={null}
          />
          <SyncWithGraphPlugin node={treeNode.object} />
          {isEditorEditable && <ClearEditorPlugin />}
          {isEditorEditable && <EnterKeyPlugin treeNode={treeNode} />}
          {isEditorEditable && tree.isNodeFocused(treeNode.id) && (
            <DropdownMenuPlugin treeNode={treeNode} boundaryRef={boundaryRef} />
          )}
          {isEditorEditable && <LeftRightArrowAtEndsPlugin />}
          {isEditorEditable && <BackspaceMergeNodesPlugin />}
          {isEditorEditable && <PastePlugin />}
          {isEditorEditable && <RelationPlugin />}
          <NodeEventPlugin
            nodeType={MentionNode}
            eventType={"click"}
            eventListener={(e: Event) => {
              const nodeId = (e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!;
              e.stopPropagation();
              const node = graphStore.getNode(nodeId);
              if (node) {
                router.push(createRouteUrl(node.getPath()));
              }
            }}
          />
          <ViewControllerRegistryPlugin pathToNodeStr={treeNode.path} />
          {isEditorEditable && <BindFocusToTreePlugin />}
          <ToggleEditablePlugin treeNode={treeNode} editable={isEditorEditable} />
        </LexicalComposer>
      </div>
    );
  },
);
