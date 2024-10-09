"use client";
import { observer } from "mobx-react-lite";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { getOtherObject } from "@/app/graph/utils";
import { useSetRoot } from "@/app/tree/utils";

import s from "./AllNodesView.module.css";

export const AllNodesView = observer(function AllNodesView() {
  const graphStore = useGraphStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setRoot = useSetRoot();

  const selectedAuthorId = searchParams.get("authorId") || "all";
  const [showDirectNodes, setShowDirectNodes] = useState(false);

  const authorOptions = useMemo(() => {
    const userNodes = graphStore.getAllUserNodes();
    return userNodes.map((userNode) => ({
      value: userNode.authorId,
      label: `${userNode.text} (${userNode.authorId})`,
    }));
  }, [graphStore]);

  const filteredNodes = useMemo(() => {
    const nodeIdsOnHomePage = new Set(
      Array.from(graphStore.getRelationList(graphStore.userRoot).values())
        .map(({ item }) => getOtherObject(item, graphStore.userRoot.id)?.id ?? "")
        .filter((id) => id !== ""),
    );
    return Array.from(graphStore.nodesById.values())
      .filter((node) => selectedAuthorId === "all" || node.authorId === selectedAuthorId)
      .filter((node) => {
        if (showDirectNodes && selectedAuthorId !== "all") {
          return !nodeIdsOnHomePage.has(node.id) && !node.isUserNode;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [graphStore, selectedAuthorId, showDirectNodes]);

  return (
    <div className={s.AllNodesView}>
      <div className={s.AllNodesContent}>
        <div className={s.HeadingContainer}>
          <div className={s.TitleContainer}>
            <h1 className={s.TitleText}>All Nodes</h1>
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
              {authorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedAuthorId !== "all" && (
              <label className={s.DirectNodesCheckbox}>
                <input
                  type="checkbox"
                  checked={showDirectNodes}
                  onChange={() => {
                    setShowDirectNodes((v) => !v);
                  }}
                />
                Hide Home Page Nodes
              </label>
            )}
          </div>
        </div>
        <div className={s.Nodes}>
          <div className={s.NodeHeader}>
            <span className={s.NodeHeaderText}>Node Content</span>
            <span className={s.NodeHeaderDate}>Date Created</span>
          </div>
          <div className={s.NodeList}>
            {filteredNodes.map((node) => (
              <div key={node.id} className={s.NodeItem} onClick={() => setRoot(node.getPath())}>
                <span className={s.NodeText}>{node.text}</span>
                <span className={s.NodeDate}>{new Date(node.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
