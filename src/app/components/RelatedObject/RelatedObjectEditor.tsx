import { observer } from "mobx-react-lite";
import { useRef } from "react";

import { NodeContentEditor } from "@/app/editor/nodeEditors";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./RelatedObjectEditor.module.css";

export const RelatedObjectEditor = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const object = treeNode.object;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={styles.Container}>
      <div className={styles.ColumnContainer}>
        {object instanceof GraphNode ? (
          <div className={styles.FlexContainer}>
            <NodeContentEditor treeNode={treeNode} />
          </div>
        ) : (
          <span className={styles.TextContent}>{object.text}</span>
        )}
      </div>
    </div>
  );
});
