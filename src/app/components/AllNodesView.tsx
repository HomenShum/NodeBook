"use client";
import { observer } from "mobx-react-lite";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSetRoot } from "@/app/tree/utils";

import s from "./AllNodesView.module.css";

export const AllNodesView = observer(function AllNodesView() {
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();

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
              <div key={node.id} className={s.NodeItem} onClick={() => setRoot({ object: node })}>
                <span className={s.NodeText}>{node.text}</span>
                <span className={s.NodeDate}>{new Date(node.createdAt).toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});
