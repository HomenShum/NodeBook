import { observer } from "mobx-react-lite";
import { useRef } from "react";

import { NodeContentEditor } from "@/app/editor/NodeContentEditor";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { cn } from "@/lib/utils";

export const RelatedObjectEditor = observer(
  ({ indentationWidth, object }: { indentationWidth: string; object: GraphObject }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div
        ref={ref}
        style={{
          gap: "5px",
          display: "flex",
          alignItems: "flex-start",
          flex: 1,
        }}
      >
        <div className="flex flex-col flex-1">
          {object instanceof GraphNode ? (
            <div className={cn("flex min-w-64")}>
              <NodeContentEditor indent={indentationWidth} />
            </div>
          ) : (
            <span className="italic">{object.text}</span>
          )}
        </div>
      </div>
    );
  },
);
