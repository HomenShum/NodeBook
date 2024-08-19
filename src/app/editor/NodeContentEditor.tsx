import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { AutocompleteDropdownPlugin } from "@/app/editor/plugins/AutocompleteDropdownPlugin";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { BindFocusToTreePlugin } from "@/app/editor/plugins/BindFocusToTreePlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { LeftRightArrowAtEndsPlugin } from "@/app/editor/plugins/LeftRightArrowAtEndsPlugin";
import { MentionPlugin } from "@/app/editor/plugins/MentionPlugin";
import { PastePlugin } from "@/app/editor/plugins/pastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { createRouteUrl } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";
import { cn } from "@/lib/utils";

import { SyncWithGraphPlugin } from "./plugins/SyncWithGraphPlugin";

import styles from "./Editor.module.css";

type NodeEditorProps = {
  treeNode: DescendantTreeNode;
  isEditable: boolean;
  setIsEditable: (isEditable: boolean) => void;
};

export const NodeEditor = observer(({ treeNode, isEditable, setIsEditable }: NodeEditorProps) => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const router = useRouter();
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }

  const setPathToNodeAsRoot = useCallback(
    (nodeId: string) => {
      const node = graphStore.getNode(nodeId);
      if (node) {
        router.push(createRouteUrl(ViewType.GRAPH, { object: node }));
      }
    },
    [graphStore, router],
  );

  const showSearchAndReplaceDropdown =
    !mentionDropdownOpen &&
    (settingsStore.searchAndReplaceDropdown === "all" ||
      (settingsStore.searchAndReplaceDropdown === "labelled-only" && treeNode.relationWithParent?.isLabelled()));

  return (
    <div ref={ref} className={cn(styles.EditorWrapper, settingsStore.showAtSignOnMention && styles.showAtSignPrefix)}>
      <LexicalComposer initialConfig={createConfig({ namespace: "descendant-editor", treeNode })}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
          placeholder={null}
        />
        <ClearEditorPlugin />
        {treeNode.object instanceof GraphNode && <SyncWithGraphPlugin node={treeNode.object} />}
        <EnterKeyPlugin treeNode={treeNode} />
        <MentionPlugin treeNode={treeNode} setDropdownOpen={setMentionDropdownOpen} />
        <LeftRightArrowAtEndsPlugin />
        <BackspaceMergeNodesPlugin />
        <PastePlugin />
        <RelationPlugin />
        <NodeEventPlugin
          nodeType={MentionNode}
          eventType={"click"}
          eventListener={(e: Event) => {
            e.stopPropagation();
            setPathToNodeAsRoot((e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!);
          }}
        />
        {showSearchAndReplaceDropdown && <AutocompleteDropdownPlugin parentRef={ref} />}
        <ViewControllerRegistryPlugin pathToNodeStr={treeNode.path} />
        <BindFocusToTreePlugin />
        <ToggleEditablePlugin treeNode={treeNode} isEditable={isEditable} setIsEditable={setIsEditable} />
      </LexicalComposer>
    </div>
  );
});
