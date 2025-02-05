import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import React from "react";
import { observer } from "mobx-react-lite";

import { Button } from "@/app/components/UIPrimitives/Button";
import { cn } from "@/lib/utils";
import { useSlugs } from "@/app/contexts/SlugContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

export const MyShortlinksTree = observer(function MyShortlinksTree() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { slugs, fetchAllSlugs } = useSlugs();
  const setRoot = useSetMainRoot();
  const graphStore = useGraphStore();

  useEffect(() => {
    fetchAllSlugs();
  }, []);

  useEffect(() => {
    graphStore.layerManager.loadWithIds(Object.keys(slugs));
  }, [graphStore.layerManager, slugs]);

  const handleOnClick = (nodeId: string) => {
    const node = graphStore.nodesById.get(nodeId);
    if (node) {
      setRoot(node);
      return;
    }
    window.location.href = "/" + slugs[nodeId];
  };

  return (
    <div className={styles.SidebarTreeContainer}>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <span>My Shortlinks</span>
        <div className={styles.HeaderControls}>
          <Button variant="ghost" className={styles.HeaderButton} onClick={() => setIsExpanded(!isExpanded)}>
            <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div className={styles.SidebarTreeChildren}>
          {Object.keys(slugs).length === 0 ? (
            <div className={styles.EmptyMessage}>No links yet</div>
          ) : (
            Array.from(Object.keys(slugs)).map((nodeId) => (
              <Button onClick={() => handleOnClick(nodeId)} key={nodeId} variant="ghost" className={cn(styles.Button)}>
                /{slugs[nodeId]}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
