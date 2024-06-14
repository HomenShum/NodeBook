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

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useViewStore } from "@/app/view/useViewStore";
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
import { ArrowKeyMoveNodePlugin } from "./plugins/keyboard/ArrowKeyMoveNodePlugin";
import { ArrowKeyNavPlugin } from "./plugins/keyboard/ArrowKeyNavPlugin";
import { BackspaceMergeNodesPlugin } from "./plugins/keyboard/BackspaceMergeNodesPlugin";
import { EnterKeyPlugin } from "./plugins/keyboard/EnterKeyPlugin";
import { EnterTempEditPlugin } from "./plugins/keyboard/EnterTempEditPlugin";
import { ExitTempEditPlugin } from "./plugins/keyboard/ExitTempEditPlugin";
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
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const { object: node, pathToNodeStr, isChild } = useRelationAtPath();
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  if (!(node instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [MentionNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(node.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
    },
    editable:
      node.id !== graphStore.outlineRoot.id &&
      node.id !== graphStore.thoughtstreamRoot.id &&
      node.id !== graphStore.userRoot.id,
  };

  const setPathToNodeAsRoot = useCallback(
    (nodeId: string) => {
      console.log("setPathToNodeAsRoot", nodeId);
      const node = graphStore.getNode(nodeId);
      if (!node) {
        return;
      }
      viewStore.setCurrentOutlineViewRoot(node.getPath());
    },
    [viewStore, graphStore],
  );

  const showSearchAndReplaceDropdown =
    !mentionDropdownOpen &&
    (settingsStore.searchAndReplaceDropdown === "all" ||
      (settingsStore.searchAndReplaceDropdown === "labelled-only" && !isChild));
  return (
    <div
      ref={ref}
      className={cn(styles.EditorWrapper, settingsStore.showAtSignOnMention && styles.showAtSignPrefix)}
      // style={{ textIndent: indent, position: "relative", left: `-${indent}` }}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className="outline-none" data-nodeid={node.id} />}
          placeholder={null}
        />
        <HistoryPlugin />
        <ClearEditorPlugin />
        <SyncWithGraphPlugin node={node} />
        <ArrowKeyNavPlugin />
        <ArrowKeyExpandCollapsePlugin />
        <ArrowKeyMoveNodePlugin />
        <EnterKeyPlugin />
        <TabAndBulletPlugin />
        <BackspaceMergeNodesPlugin />
        <SetNodeAsRootPlugin />
        <EnterTempEditPlugin />
        <ExitTempEditPlugin />
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
        <ViewControllerRegistryPlugin pathToNodeStr={pathToNodeStr} />
        <TrackFocusedPathPlugin pathToNodeStr={pathToNodeStr} />
        <JumpSelectionPlugin />
      </LexicalComposer>
    </div>
  );
});
