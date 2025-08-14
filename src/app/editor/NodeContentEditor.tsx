import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { observer } from "mobx-react-lite";
import { RefObject } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { ArrowKeyPlugin } from "@/app/editor/plugins/ArrowKeyPlugin";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { ContextualGenerationPlugin } from "@/app/editor/plugins/ContextualGenerationPlugin";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { FormatKeyPlugin } from "@/app/editor/plugins/FormatKeyPlugin";
import { FormattingMenuPlugin } from "@/app/editor/plugins/FormattingMenuPlugin";
import { IgnoreModShiftAPlugin } from "@/app/editor/plugins/IgnoreModShiftAPlugin";
import { LinkPlugin } from "@/app/editor/plugins/LinkPlugin";
import { MinusKeyPlugin } from "@/app/editor/plugins/MinusKeyPlugin";
import { PastePlugin } from "@/app/editor/plugins/PastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { ReplacementPlugin } from "@/app/editor/plugins/ReplacementPlugin";
import { SearchQueryHighlightPlugin } from "@/app/editor/plugins/SearchQueryHighlightPlugin";
import { SelectAllPlugin } from "@/app/editor/plugins/SelectAllPlugin";
import { SigilsPlugin } from "@/app/editor/plugins/SigilsPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { TodoPlugin } from "@/app/editor/plugins/TodoPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { useClickableMention } from "@/app/editor/utils/useClickableMention";
import { GraphNode } from "@/app/graph/GraphNode";
import { ImageNode } from "@/app/graph/ImageNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./Editor.module.css";

interface Props {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
  editorRef: RefObject<HTMLDivElement>;
}

export const NodeEditor = observer(function NodeEditor({ treeNode, isEditorEditable, editorRef }: Props) {
  const viewStore = useViewStore();
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }

  const tree = treeNode.tree;
  const handleMentionNodeClick = useClickableMention(treeNode);

  const handleImageClick = (event: Event) => {
    const src = (event.target as HTMLImageElement).src;
    src && viewStore.setSrcForImageViewer(src);
  };

  return (
    <div className={styles.EditorWrapper} ref={editorRef}>
      <LexicalComposer
        initialConfig={createConfig({
          namespace: "descendant-editor",
          treeNode,
          editable: isEditorEditable,
        })}
      >
        <RichTextPlugin
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
        {isEditorEditable && <ArrowKeyPlugin />}
        {isEditorEditable && <SigilsPlugin treeNode={treeNode} />}
        {isEditorEditable && <BackspaceMergeNodesPlugin />}
        {isEditorEditable && <ClearEditorPlugin />}
        {isEditorEditable && <EnterKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && <FormatKeyPlugin />}
        {isEditorEditable && <IgnoreModShiftAPlugin />}
        {isEditorEditable && <SelectAllPlugin />}
        {isEditorEditable && <LinkPlugin />}
        {isEditorEditable && <MinusKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && <PastePlugin />}
        {isEditorEditable && <RelationPlugin />}
        {isEditorEditable && <ReplacementPlugin treeNode={treeNode} />}
        {isEditorEditable && <ContextualGenerationPlugin treeNode={treeNode} />}
        {isEditorEditable && <TodoPlugin treeNode={treeNode} />}
        {isEditorEditable && tree.isNodeFocused(treeNode.id) && <DropdownPlugin treeNode={treeNode} />}
        {isEditorEditable && <FormattingMenuPlugin/>}
        <ToggleEditablePlugin treeNode={treeNode} editable={isEditorEditable} />
        <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
        <NodeEventPlugin nodeType={ImageNode} eventType={"click"} eventListener={handleImageClick} />
        <ViewControllerRegistryPlugin treeNode={treeNode} />
        <SearchQueryHighlightPlugin />
      </LexicalComposer>
    </div>
  );
});
