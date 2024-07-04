import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { CreateNodeAtTopPlugin } from "@/app/editor/plugins/keyboard/CreateNodeAtTopPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { isUnlabelledChild } from "@/app/view/Tree";
import { useTree } from "@/app/view/TreeContext";
import { cn } from "@/lib/utils";

import { IgnoreSpaceAtStartOfLabelledRelationsPlugin } from "./plugins/IgnoreSpaceAtStartOfLabelledRelationsPlugin";
import { JumpSelectionPlugin } from "./plugins/JumpSelectionPluigin";
import { MentionPlugin } from "./plugins/MentionPlugin";
import { RelationPlugin } from "./plugins/RelationPlugin";
import { ReplaceObjectPlugin } from "./plugins/ReplaceObjectPlugin";
import { AutocompleteDropdownPlugin } from "./plugins/SearchAndReplaceDropdownPlugin";
import { SyncWithGraphPlugin } from "./plugins/SyncWithGraphPlugin";
import { TrackFocusedPathPlugin } from "./plugins/TrackFocusedPathPlugin";
import { ViewControllerRegistryPlugin } from "./plugins/ViewControllerRegistryPlugin";
import { ArrowKeyExpandCollapsePlugin } from "./plugins/keyboard/ArrowKeyExpandCollapsePlugin";
import { ArrowKeyNavPlugin } from "./plugins/keyboard/ArrowKeyNavPlugin";
import { BackspaceMergeNodesPlugin } from "./plugins/keyboard/BackspaceMergeNodesPlugin";
import { EnterKeyPlugin } from "./plugins/keyboard/EnterKeyPlugin";
import { SetNodeAsRootPlugin } from "./plugins/keyboard/SetNodeAsRootPlugin";
import { TabAndBulletPlugin } from "./plugins/keyboard/TabAndBulletPlugin";
import { PastePlugin } from "./plugins/pastePlugin";

import styles from "./Editor.module.css";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

export const NodeContentEditor = observer(({ indent }: { indent: string }) => {
  const settingsStore = useSettingsStore();
  const tree = useTree();
  const graphStore = useGraphStore();
  const { treeNode } = useTreeNode();
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [MentionNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(treeNode.object.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
    },
    editable:
      treeNode.object.id !== graphStore.outlineRoot.id &&
      treeNode.object.id !== graphStore.thoughtstreamRoot.id &&
      treeNode.object.id !== graphStore.userRoot.id,
  };

  const setPathToNodeAsRoot = useCallback(
    (nodeId: string) => {
      const node = graphStore.getNode(nodeId);
      if (node) {
        tree.setRoot(node.getPath());
      }
    },
    [tree, graphStore],
  );

  const showSearchAndReplaceDropdown =
    !mentionDropdownOpen &&
    (settingsStore.searchAndReplaceDropdown === "all" ||
      (settingsStore.searchAndReplaceDropdown === "labelled-only" && !isUnlabelledChild(treeNode)));
  return (
    <div
      ref={ref}
      className={cn(styles.EditorWrapper, settingsStore.showAtSignOnMention && styles.showAtSignPrefix)}
      // style={{ textIndent: indent, position: "relative", left: `-${indent}` }}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
          placeholder={null}
        />
        <HistoryPlugin />
        <ClearEditorPlugin />
        {treeNode.object instanceof GraphNode && <SyncWithGraphPlugin node={treeNode.object} />}
        <ArrowKeyNavPlugin />
        <ArrowKeyExpandCollapsePlugin />
        <EnterKeyPlugin />
        <TabAndBulletPlugin />
        <BackspaceMergeNodesPlugin />
        <CreateNodeAtTopPlugin />
        <SetNodeAsRootPlugin />
        <ReplaceObjectPlugin />
        <PastePlugin />
        <RelationPlugin />
        <MentionPlugin setDropdownOpen={setMentionDropdownOpen} />
        <NodeEventPlugin
          nodeType={MentionNode}
          eventType={"click"}
          eventListener={(e: Event) => {
            setPathToNodeAsRoot((e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!);
          }}
        />
        {showSearchAndReplaceDropdown && <AutocompleteDropdownPlugin parentRef={ref} />}
        <IgnoreSpaceAtStartOfLabelledRelationsPlugin />
        <ViewControllerRegistryPlugin pathToNodeStr={treeNode.path} />
        <TrackFocusedPathPlugin pathToNodeStr={treeNode.path} />
        <JumpSelectionPlugin />
      </LexicalComposer>
    </div>
  );
});
