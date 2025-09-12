import { RotateCcw, RotateCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList as List } from "react-window";

import { QuickCaptureIcon } from "@/app/components/CustomIcons";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { SerializedNode } from "@/app/persistence/SerializedData";
import { TreeContext } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import { GraphUpdate, AddNode, AddRelation, DeleteNode, DeleteRelation, UpdateNode, UpdateRelation } from "@/app/graph/GraphUpdate";

import s from "./UpdatesFeed.module.css";

interface NodeIdWithTooltipProps {
  nodeId: string;
  nodeContent?: SerializedNode;
}

const NodeIdWithTooltip = ({ nodeId, nodeContent }: NodeIdWithTooltipProps) => {
  const graphStore = useGraphStore();
  const node = graphStore.nodesById.get(nodeId);
  const content =
    node?.content.map((c) => (c.type === "image" ? "" : c.value)).join("") ||
    nodeContent?.content.map((c) => (c.type === "image" ? "" : c.value)).join("") ||
    "Node no longer exists";

  return (
    <span className={s.NodeId} title={content}>
      {nodeId}
    </span>
  );
};

const getUpdateDescription = (update: GraphUpdate): JSX.Element => {
  switch (update.operation) {
    case "addNode":
      return (
        <>
          Added node: <NodeIdWithTooltip nodeId={update.node.id} nodeContent={update.node} /> with content &ldquo;
          {update.node.content.map((c) => (c.type === "image" ? "Image" : c.value)).join("")}&rdquo;
        </>
      );
    case "updateNode":
      return (
        <>
          Updated node: <NodeIdWithTooltip nodeId={update.oldProps.id} nodeContent={update.newProps} /> with content
          &ldquo;
          {update.newProps.content.map((c) => (c.type === "image" ? "Image" : c.value)).join("")}&rdquo;
        </>
      );
    case "deleteNode":
      return (
        <>
          Deleted node: <NodeIdWithTooltip nodeId={update.node.id} nodeContent={update.node} /> with content &ldquo;
          {update.node.content.map((c) => (c.type === "image" ? "Image" : c.value)).join("")}&rdquo;
        </>
      );
    case "addRelation":
      return (
        <>
          Added relation: {update.relation.id} between <NodeIdWithTooltip nodeId={update.relation.fromId} /> and{" "}
          <NodeIdWithTooltip nodeId={update.relation.toId} />
        </>
      );
    case "updateRelation":
      return (
        <>
          Updated relation: {update.oldProps.id} between <NodeIdWithTooltip nodeId={update.oldProps.fromId} /> and{" "}
          <NodeIdWithTooltip nodeId={update.oldProps.toId} />
        </>
      );
    case "deleteRelation":
      return (
        <>
          Deleted relation: {update.deleted.relation.id} between{" "}
          <NodeIdWithTooltip nodeId={update.deleted.relation.fromId} /> and{" "}
          <NodeIdWithTooltip nodeId={update.deleted.relation.toId} />
        </>
      );
    case "updateRelationList":
      return (
        <>
          Reordered relations in <NodeIdWithTooltip nodeId={update.nodeId} />
        </>
      );
    default:
      const _exhaustiveCheck: never = update;
      return <>Unknown update</>;
  }
};

export const UpdatesFeed = observer(function UpdatesFeed() {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const user = useUser();
  // Get updates in reverse chronological order
  const listRef = useRef<List>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(26);
  const [filterByRoot, setFilterByRoot] = useState(false);
  const [updates, setUpdates] = useState(graphStore.updateManager.sessionUpdates.slice().reverse());

  useEffect(() => {
    if (measureRef.current) {
      const height = measureRef.current.getBoundingClientRect().height;
      setLineHeight(height);
    }
  }, []);

  // Reset list cache when updates change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [updates]);

  const getItemSize = useCallback(
    (index: number) => {
      const update = updates[index];
      // Base height for padding + update number
      let height = 55;
      // Add height for each update description
      height += update.length * (4 + lineHeight);
      return height;
    },
    [updates, lineHeight],
  );

  const handleUndo = useCallback(
    (index: number) => {
      // Undo all updates after this point
      for (let i = 0; i <= index; i++) {
        graphStore.updateManager.undo();
      }
      // Reset the list cache to force re-render
      if (listRef.current) {
        listRef.current.resetAfterIndex(0);
      }
    },
    [graphStore.updateManager],
  );

  const handleGlobalUndo = useCallback(() => {
    graphStore.updateManager.undo();
  }, [graphStore.updateManager]);

  const handleGlobalRedo = useCallback(() => {
    graphStore.updateManager.redo();
  }, [graphStore.updateManager]);

  const handleFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;

    setFilterByRoot(isChecked);

    if (!isChecked) {
      const fullList = [...graphStore.updateManager.sessionUpdates].reverse();
      setUpdates(fullList);
      return;
    }

    const descendantIds = viewStore.getDescendantNodeIds();

    const filteredUpdates = [...graphStore.updateManager.sessionUpdates]
        .reverse().filter(update => {
          for (let i = 0; i < update.length; i++) {
        // Finds the relevant nodes' IDs depending on what kind of an update it is.
        switch (update[i].operation) {
          case "addRelation": {
            const addRelation = update[i] as AddRelation;
            if (descendantIds.has(addRelation.relation.toId) ||
                descendantIds.has(addRelation.relation.fromId)) {
              return true;
            }
            break;
          }
          case "updateRelationList": {
            // This type of update has no node changes.
            break;
          }
          case "updateNode": {
            const updateNode = update[i] as UpdateNode;
            if (descendantIds.has(updateNode.oldProps.id)) {
              return true;
            }
            break;
          }
          case "addNode": {
            const addNode = update[i] as AddNode;
            if (descendantIds.has(addNode.node.id)) {
              return true;
            }
            break;
          }
          case "updateRelation": {
            const updateRelation = update[i] as UpdateRelation;
            if (descendantIds.has(updateRelation.oldProps.toId) ||
                descendantIds.has(updateRelation.oldProps.fromId)) {
              return true;
            }
            break;
          }
          case "deleteRelation": {
            const deleteRelation = update[i] as DeleteRelation;
            if (descendantIds.has(deleteRelation.deleted.relation.toId) ||
                descendantIds.has(deleteRelation.deleted.relation.fromId)) {
              return true;
            }
            break;
          }
          case "deleteNode": {
            const deleteNode = update[i] as DeleteNode;
            if (descendantIds.has(deleteNode.node.id)) {
              return true;
            }
            break;
          }
        }
      }
      return false;
    });

    setUpdates(filteredUpdates);
  }, [graphStore.updateManager, viewStore]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const update = updates[index];
    const updateNumber = updates.length - index;

    return (
      <div className={s.UpdateItem} style={style}>
        <div className={s.UpdateContent}>
          <div className={s.UpdateHeader}>
            <div className={s.UpdateNumber}>
              Update #{updateNumber}
              <Button
                variant="ghost"
                size="icon"
                className={s.UndoButton}
                style={{ cursor: "pointer" }}
                onClick={() => handleUndo(index)}
                title="Revert up to this state (inclusive)"
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>
          {update.map((u, i) => (
            <div key={i} className={s.UpdateDescription}>
              {getUpdateDescription(u)}
            </div>
          ))}
        </div>
        <span className={s.UpdateTimestamp}>{new Date().toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div className={s.UpdatesFeed}>
      <TreeContext.Provider value={viewStore.quickCaptureTree}>
        <QuickCapture />
      </TreeContext.Provider>
      <div className={s.HeadingContainer}>
        <div className={s.TitleContainer}>
          <h1 className={s.TitleText}>Updates Feed</h1>
          {!user.isAnonymous && (
            <Button
              className={cn(s.ShowTooltip, s.RightAlign)}
              data-tooltip={viewStore.quickCaptureOpen ? `Close Quick Capture` : `Open Quick Capture`}
              variant={viewStore.quickCaptureOpen ? "active" : "default"}
              size="icon"
              onClick={() =>
                viewStore.quickCaptureOpen ? viewStore.closeQuickCapture() : viewStore.openQuickCapture()
              }
            >
              <QuickCaptureIcon />
            </Button>
          )}
          <div className={s.GlobalActions}>
            <Button
              style={{ cursor: "pointer" }}
              variant="ghost"
              className={s.GlobalButton}
              onClick={handleGlobalUndo}
              title="Undo last action"
            >
              <RotateCcw size={16} strokeWidth={2} />
              <span>Undo</span>
            </Button>
            <Button
              style={{ cursor: "pointer" }}
              variant="ghost"
              className={s.GlobalButton}
              onClick={handleGlobalRedo}
              title="Redo last action"
            >
              <RotateCw size={16} strokeWidth={2} />
              <span>Redo</span>
            </Button>

            <label className={s.GlobalButton}>
              <input type="checkbox" checked={filterByRoot} onChange={handleFilter}/>
                Filter Updates by Root
            </label>
          </div>
        </div>
        <p className={s.Description}>
          Click the undo button next to an update to revert the graph to that state. Use your redo action to undo the
          reversions.
        </p>
      </div>
      <div className={s.UpdatesTable}>
        <div className={s.UpdateHeader}>
          <span className={s.UpdateHeaderText}>Update Description</span>
          <span className={s.UpdateHeaderDate}>Timestamp</span>
        </div>
        <div style={{ flex: 1 }}>
          <AutoSizer>
            {({ height, width }) => (
              <List ref={listRef} height={height} itemCount={updates.length} itemSize={getItemSize} width={width}>
                {Row}
              </List>
            )}
          </AutoSizer>
        </div>
      </div>
    </div>
  );
});
