import { observer } from "mobx-react-lite";
import { useRef } from "react";

import { NodeContentEditor } from "@/app/editor/NodeContentEditor";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";

import styles from "./RelatedObjectEditor.module.css";

export const RelatedObjectEditor = observer(
  ({ indentationWidth, object }: { indentationWidth: string; object: GraphObject }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div ref={ref} className={styles.Container}>
        <div className={styles.ColumnContainer}>
          {object instanceof GraphNode ? (
            <div className={styles.FlexContainer}>
              <NodeContentEditor indent={indentationWidth} />
            </div>
          ) : (
            <span className={styles.TextContent}>{object.text}</span>
          )}
        </div>
      </div>
    );
  },
);
