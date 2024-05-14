import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { cn } from "@/lib/utils";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";
import { useRelationAtPath } from "../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../controller/useViewController";
import { GraphNode } from "../model/GraphNode";
import { MentionNode } from "../model/MentionNode";
import { useGraphStore } from "../store/useGraphStore";
import styles from "./Editor.module.css";
import { IgnoreSpaceAtStartOfLabelledRelationsPlugin } from "./plugins/IgnoreSpaceAtStartOfLabelledRelationsPlugin";
import { KeyboardOverridesPlugin } from "./plugins/KeyboardOverridesPlugin";
import { MentionPlugin } from "./plugins/MentionPlugin";
import { RelationPlugin } from "./plugins/RelationPlugin";
import { AutocompleteDropdownPlugin } from "./plugins/SearchAndReplaceDropdownPlugin";
import { SyncWithGraphPlugin } from "./plugins/SyncWithGraphPlugin";
import { TrackFocusedPath } from "./plugins/TrackFocusedPath";
import { ViewControllerRegistryPlugin } from "./plugins/ViewControllerRegistryPlugin";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

export const NodeContentEditor = observer(() => {
  const view = useViewController();
  const graphStore = useGraphStore();
  const { object: node, relation, pathToNodeStr, pathToParentRelations, isChild, viewType } = useRelationAtPath();
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
      view.setCurrentOutlineViewRoot(node.getPath());
    },
    [view, graphStore],
  );

  const showSearchAndReplaceDropdown =
    !mentionDropdownOpen &&
    (view.searchAndReplaceDropdown === "all" || (view.searchAndReplaceDropdown === "labelled-only" && !isChild));
  return (
    <div ref={ref} className={cn(styles.EditorWrapper, view.showAtSignOnMention && styles.showAtSignPrefix)}>
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className="outline-none" data-nodeid={node.id} />}
          placeholder={null}
        />
        <HistoryPlugin />
        <ClearEditorPlugin />
        <SyncWithGraphPlugin node={node} />
        <KeyboardOverridesPlugin />
        <RelationPlugin />
        <MentionPlugin setDropdownOpen={setMentionDropdownOpen} />
        <NodeEventPlugin
          nodeType={MentionNode}
          eventType={"click"}
          eventListener={(e: Event) => {
            console.log(e.target);
            setPathToNodeAsRoot((e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!);
          }}
        />
        {showSearchAndReplaceDropdown && <AutocompleteDropdownPlugin parentRef={ref} />}
        <IgnoreSpaceAtStartOfLabelledRelationsPlugin />
        <ViewControllerRegistryPlugin pathToNodeStr={pathToNodeStr} />
        <TrackFocusedPath pathToNodeStr={pathToNodeStr} />
      </LexicalComposer>
    </div>
  );
});
