import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { mergeRegister } from "@lexical/utils";
import { COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND } from "lexical";
import { observer } from "mobx-react-lite";
import { useEffect, useLayoutEffect } from "react";

import { createConfig } from "@/app/editor/createConfig";
import { MentionPlugin } from "@/app/editor/plugins/MentionPlugin";
import { SyncWithGraphPlugin } from "@/app/editor/plugins/SyncWithGraphPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./Editor.module.css";

export const NodeReferenceEditor = observer(
  ({ treeNode, onClose }: { treeNode: DescendantTreeNode; onClose: () => void }) => {
    return (
      <div>
        <LexicalComposer initialConfig={createConfig({ namespace: "header-editor", treeNode })}>
          <PlainTextPlugin
            ErrorBoundary={LexicalErrorBoundary}
            contentEditable={<ContentEditable className={styles.ContentEditable} data-nodeid={treeNode.object.id} />}
            placeholder={null}
          />
          <HandleClosePlugin onClose={onClose} />
          <AutofocusPlugin />
          <ClearEditorPlugin />
          {treeNode.object instanceof GraphNode && <SyncWithGraphPlugin node={treeNode.object} />}
          <MentionPlugin treeNode={treeNode} />
        </LexicalComposer>
      </div>
    );
  },
);

const HandleClosePlugin = ({ onClose }: { onClose: () => void }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (e) => {
          e.stopPropagation();
          editor.blur();
          onClose();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (e) => {
          e?.stopPropagation();
          editor.blur();
          onClose();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [editor, onClose]);
  return null;
};

const AutofocusPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.focus();
  }, [editor]);

  return null;
};
