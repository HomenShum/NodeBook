"use client";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { createRouteUrl } from "@/app/util";

import s from "./AllNodesView.module.css";

export const AllNodesView = observer(() => {
  const graphStore = useGraphStore();
  const router = useRouter();

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      router.push(createRouteUrl({ object: node }));
    },
    [router],
  );

  return (
    <div className={s.AllNodesViewContainer}>
      <div className={s.HeadingContainer}>
        <div className={s.TitleContainer}>
          <h1 className={s.TitleText}>All Nodes</h1>
        </div>
      </div>
      <div className={s.Nodes}>
        <div className={s.NodeHeader}>
          <span className={s.NodeHeaderText}>Node Content</span>
          <span className={s.NodeHeaderDate}>Date Created</span>
        </div>
        <div className={s.NodeList}>
          {Array.from(graphStore.nodesById.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((node) => (
              <div key={node.id} className={s.NodeItem} onClick={() => handleNodeClick(node)}>
                <span className={s.NodeText}>{node.text}</span>
                <span className={s.NodeDate}>{new Date(node.createdAt).toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});
