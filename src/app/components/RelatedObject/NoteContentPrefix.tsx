import { observer } from "mobx-react-lite";
import React, { useRef } from "react";

import { useHandleEnterKey } from "@/app/editor/plugins/EnterKeyPlugin";
import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./styles/RelatedObjectView.module.css";

type Props = {
  treeNode: DescendantTreeNode;
};

/**
 * Renders an invisible input at the beginning of note content to allow
 * for easy navigation between note content and note content prefix.
 */
export const NoteContentPrefix = observer(function NoteContentPrefix({ treeNode }: Props) {
  const tree = treeNode.tree;
  const inputRef = useRef<HTMLInputElement>(null);
  const handleEnterKey = useHandleEnterKey(tree, treeNode);

  return (
    <div style={{ height: "20px", width: "100%", bottom: 0, position: "absolute", alignItems: "end" }}>
      <input
        data-note-prefix={treeNode.object.id}
        className={styles.NoteContentPrefix}
        onKeyDown={async (e: React.KeyboardEvent) => {
          switch (e.key) {
            // case "Enter": {
            //   return handleEnterKey(e.nativeEvent);
            // }
            // case "Backspace":
            //   try {
            //     e.preventDefault();
            //     await tree.replaceObjectAtNodeWithCopy(treeNode.id);
            //     tree.setFocusedNode(treeNode.id);
            //   } catch (error) {
            //     alert(error instanceof Error ? error.message : "Unknown error");
            //   }
            //   break;
            case "ArrowRight":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              tree.setFocusedNode(treeNode.childrenGroupsById["noteContent"].nodes[0].id, "start");
              break;
            case "ArrowDown":
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              tree.moveEditorSelectionDown("start");
              break;
            // case "ArrowUp":
            //   e.preventDefault();
            //   e.stopPropagation();
            //   e.nativeEvent.stopImmediatePropagation();
            //   e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("start");
            //   break;
            case "ArrowLeft":
              e.preventDefault();
              tree.moveEditorSelectionUp("end");
              break;
          }
        }}
        type="text"
        onChange={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        value=""
      />
    </div>
  );
});
