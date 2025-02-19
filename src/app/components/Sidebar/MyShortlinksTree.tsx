import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSlugs } from "@/app/contexts/SlugContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/app/view/useViewStore";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

export const MyShortlinksTree = observer(function MyShortlinksTree() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { slugs, fetchAllSlugs } = useSlugs();
  const setRoot = useSetMainRoot();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  useEffect(() => {
    fetchAllSlugs();
  }, []);

  useEffect(() => {
    graphStore.layerManager.loadWithIds(Object.keys(slugs));
  }, [graphStore.layerManager, slugs]);

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement>, nodeId: string) => {
    e.stopPropagation();
    const node = graphStore.nodesById.get(nodeId);
    if (!node) return;
    if (e.shiftKey) {
      viewStore.createSidebarTree(node);
    } else {
      setRoot(node);
      window.location.href = "/" + slugs[nodeId];
    }
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
              <Button
                onClick={(e) => handleOnClick(e, nodeId)}
                key={nodeId}
                variant="ghost"
                className={cn(styles.Button)}
              >
                /{slugs[nodeId]}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
