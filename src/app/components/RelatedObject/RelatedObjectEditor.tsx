import { Edit2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { NodeContentEditor } from "@/app/editor/NodeContentEditor";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { useViewType } from "./ViewTypeContext";

export const RelatedObjectEditor = observer(
  ({
    isHovered,
    indentationWidth,
    object,
    pathToNodeStr,
  }: {
    isHovered: boolean;
    indentationWidth: string;
    object: GraphObject;
    pathToNodeStr: string;
  }) => {
    const graphStore = useGraphStore();
    const viewStore = useViewStore();
    const renderController = useRenderController();
    const { viewType, setViewType } = useViewType();
    const ref = useRef<HTMLDivElement>(null);
    const treatAsLink =
      object instanceof GraphNode && graphStore.shouldTreatObjectAsLink(object) && viewType !== "temp-edit";

    // close the temp edit view when clicking outside of it
    useEffect(() => {
      if (viewType === "temp-edit") {
        const handleClick = (e: MouseEvent) => {
          if (ref.current && !ref.current.contains(e.target as Node)) {
            setViewType("edit");
          }
        };
        window.addEventListener("click", handleClick);
        return () => {
          window.removeEventListener("click", handleClick);
        };
      }
    }, [object.id, setViewType, viewType, renderController, pathToNodeStr]);

    return (
      <div
        ref={ref}
        style={{
          gap: "5px",
          display: "flex",
          alignItems: "flex-start",
          flex: 1,
          color: treatAsLink ? "#0b0b79" : undefined,
          textDecoration: treatAsLink ? "underline #cecece" : undefined,
          backgroundColor: viewType === "temp-edit" ? "var(--teal-2)" : undefined,
        }}
      >
        <div className="flex flex-col flex-1">
          {object instanceof GraphNode ? (
            <div
              className={cn("flex min-w-64", treatAsLink && "cursor-pointer")}
              onClick={treatAsLink ? (e) => viewStore.togglePathExpanded(pathToNodeStr) : undefined}
            >
              <NodeContentEditor indent={indentationWidth} />
              {treatAsLink && isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewType("temp-edit");
                    renderController.setFocusedNode(pathToNodeStr);
                  }}
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          ) : (
            <span className="italic">{object.text}</span>
          )}
        </div>
      </div>
    );
  },
);
