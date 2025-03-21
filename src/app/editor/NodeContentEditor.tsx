import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from "lexical";
import { observer } from "mobx-react-lite";
import { RefObject, useEffect } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { ArrowKeyPlugin } from "@/app/editor/plugins/ArrowKeyPlugin";
import { BackspaceMergeNodesPlugin } from "@/app/editor/plugins/BackspaceMergeNodesPlugin";
import { DropdownPlugin } from "@/app/editor/plugins/dropdown/DropdownPlugin";
import { EnterKeyPlugin } from "@/app/editor/plugins/EnterKeyPlugin";
import { FormatKeyPlugin } from "@/app/editor/plugins/FormatKeyPlugin";
import { IgnoreModShiftAPlugin } from "@/app/editor/plugins/IgnoreModShiftAPlugin";
import { LinkPlugin } from "@/app/editor/plugins/LinkPlugin";
import { LogCollapsedEditorPlugin } from "@/app/editor/plugins/LogGhostBulletStatePlugin";
import { MinusKeyPlugin } from "@/app/editor/plugins/MinusKeyPlugin";
import { PastePlugin } from "@/app/editor/plugins/PastePlugin";
import { RelationPlugin } from "@/app/editor/plugins/RelationPlugin";
import { ReplacementPlugin } from "@/app/editor/plugins/ReplacementPlugin";
import { SearchQueryHighlightPlugin } from "@/app/editor/plugins/SearchQueryHighlightPlugin";
import { SigilsPlugin } from "@/app/editor/plugins/SigilsPlugin";
import { SyncWithModelsPlugin } from "@/app/editor/plugins/SyncWithModelsPlugin";
import { TodoPlugin } from "@/app/editor/plugins/TodoPlugin";
import { ToggleEditablePlugin } from "@/app/editor/plugins/ToggleEditablePlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { useClickableMention } from "@/app/editor/utils/useClickableMention";
import { GraphNode } from "@/app/graph/GraphNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

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

  function PreventCommandBackspace() {
    const [editor] = useLexicalComposerContext();
    const tree = useTree();
    useEffect(() => {
      return editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Backspace") {
            const res = tree.deletedRelationTypeOfEmptySelection();
            if (res) {
              event.stopPropagation();
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      );
    }, [editor, tree]);
    return null;
  }

  const tree = treeNode.tree;
  const handleMentionNodeClick = useClickableMention(treeNode);

  return (
    <div className={styles.EditorWrapper} ref={editorRef}>
      <LexicalComposer
        initialConfig={createConfig({ namespace: "descendant-editor", treeNode, editable: isEditorEditable })}
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
        {isEditorEditable && <LinkPlugin />}
        {isEditorEditable && <MinusKeyPlugin treeNode={treeNode} />}
        {isEditorEditable && <PastePlugin />}
        {isEditorEditable && <PreventCommandBackspace />}
        {isEditorEditable && <RelationPlugin />}
        {isEditorEditable && <ReplacementPlugin treeNode={treeNode} />}
        {isEditorEditable && <TodoPlugin treeNode={treeNode} />}
        {isEditorEditable && tree.isNodeFocused(treeNode.id) && <DropdownPlugin treeNode={treeNode} />}
        <NodeEventPlugin nodeType={MentionNode} eventType={"click"} eventListener={handleMentionNodeClick} />
        <ViewControllerRegistryPlugin treeNode={treeNode} />
        <SearchQueryHighlightPlugin />

        <ToggleEditablePlugin treeNode={treeNode} editable={isEditorEditable} />
        <LogCollapsedEditorPlugin />
      </LexicalComposer>
    </div>
  );
});
