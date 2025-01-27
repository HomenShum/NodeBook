import { RotateCcw, RotateCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList as List } from "react-window";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import s from "./UpdatesFeed.module.css";

const getUpdateDescription = (update: GraphUpdate): string => {
  switch (update.operation) {
    case "addNode":
      return `Added node: ${update.node.id} with content "${update.node.content.map((c) => c.value).join("")}"`;
    case "updateNode":
      return `Updated node: ${update.oldProps.id} with content "${update.newProps.content
        .map((c) => c.value)
        .join("")}"`;
    case "deleteNode":
      return `Deleted node: ${update.node.id} with content "${update.node.content.map((c) => c.value).join("")}"`;
    case "addRelation":
      return `Added relation: ${update.relation.id} between ${update.relation.fromId} and ${update.relation.toId}`;
    case "updateRelation":
      return `Updated relation: ${update.oldProps.id} between ${update.oldProps.fromId} and ${update.oldProps.toId}`;
    case "deleteRelation":
      return `Deleted relation: ${update.deleted.relation.id} between ${update.deleted.relation.fromId} and ${update.deleted.relation.toId} `;
    case "updateRelationList":
      return `Reordered relations in ${update.nodeId}`;
    default:
      const _exhaustiveCheck: never = update;
      return `Unknown update`;
  }
};

export const UpdatesFeed = observer(function UpdatesFeed() {
  const graphStore = useGraphStore();
  // Get updates in reverse chronological order
  const updates = [...graphStore.updateManager.sessionUpdates].reverse();
  const listRef = useRef<List>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(26);

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
      {/* Hidden element to measure line height */}
      <div ref={measureRef} className={s.UpdateDescription} style={{ position: "absolute", visibility: "hidden" }}>
        Test text
      </div>
      <div className={s.HeadingContainer}>
        <div className={s.TitleContainer}>
          <h1 className={s.TitleText}>Updates Feed</h1>
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
