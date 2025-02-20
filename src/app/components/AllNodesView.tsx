"use client";

import { observer } from "mobx-react-lite";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";

import { QuickCaptureIcon } from "@/app/components/Icons/QuickCaptureIcon";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { getOtherObject } from "@/app/graph/utils";
import { TreeContext } from "@/app/tree/TreeContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { GLOBAL_ADMIN_USER_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";

import s from "./AllNodesView.module.css";

export const AllNodesView = observer(function AllNodesView() {
  const graphStore = useGraphStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setRoot = useSetMainRoot();
  const viewStore = useViewStore();
  const user = useUser();

  const selectedAuthorId = searchParams.get("authorId") || "all";
  const [hideHomepageNodes, setHideHomepageNodes] = useState(false);

  const { nodes, users } = useMemo(() => {
    let nodes: GraphNode[] = [];
    const authorIds = new Set<string>();
    const nodeIdsOnHomePage = new Set(
      Array.from(graphStore.getRelationList(graphStore.userRoot).values())
        .map(({ item }) => getOtherObject(item, graphStore.userRoot.id)?.id ?? "")
        .filter((id) => id !== ""),
    );

    for (const node of graphStore.nodesById.values()) {
      authorIds.add(node.authorId);
      // Skip nodes authored by other users
      if (selectedAuthorId !== "all" && node.authorId !== selectedAuthorId) {
        continue;
      }
      if (hideHomepageNodes && selectedAuthorId !== "all" && (nodeIdsOnHomePage.has(node.id) || node.isUserNode)) {
        continue;
      }
      nodes.push(node);
    }
    nodes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const authorOptions = Array.from(authorIds).map((authorId) => {
      const user = graphStore.getUserNodeByAuthorId(authorId);
      const username = user ? user.text : authorId === GLOBAL_ADMIN_USER_ID ? "System" : "Unknown user name";
      return {
        value: authorId,
        label: `${username} (${authorId})`,
      };
    });

    return { nodes, users: authorOptions };
  }, [graphStore, selectedAuthorId, hideHomepageNodes]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const node = nodes[index];
    return (
      <div key={node.id} className={s.NodeItem} onClick={() => setRoot(node)} style={style}>
        <div className={s.NodeTextContainer}>
          <span className={s.NodeText}>{node.text}</span>
        </div>
        <span className={s.NodeDate}>{new Date(node.createdAt).toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div className={s.AllNodesView}>
      <TreeContext.Provider value={viewStore.quickCaptureTree}>
        <QuickCapture />
      </TreeContext.Provider>
      <div className={s.HeadingContainer}>
        <div className={s.TitleContainer}>
          <h1 className={s.TitleText}>All Nodes</h1>
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
        </div>
        <div className={s.AuthorFilterContainer}>
          <span className={s.FilterLabel}>Filters</span>
          <select
            className={s.AuthorFilter}
            value={selectedAuthorId}
            onChange={(e) => {
              router.push(`/all-nodes?authorId=${e.target.value}`);
            }}
          >
            <option value="all">All Users</option>
            {users.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedAuthorId !== "all" && (
            <label className={s.DirectNodesCheckbox}>
              <input
                type="checkbox"
                checked={hideHomepageNodes}
                onChange={() => {
                  setHideHomepageNodes((v) => !v);
                }}
              />
              Hide Home Page Nodes
            </label>
          )}
        </div>
      </div>
      <div className={s.NodesTable}>
        <div className={s.NodeHeader}>
          <span className={s.NodeHeaderText}>Node Content</span>
          <span className={s.NodeHeaderDate}>Date Created</span>
        </div>
        <div className={s.NodeList}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                itemCount={nodes.length}
                itemSize={60} // Increased from 50 to give more space
                width={width}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </div>
      </div>
    </div>
  );
});
