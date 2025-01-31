import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

interface TreeElementProps {
  object: GraphObject;
}

const TreeElement = observer(function TreeElement({ object }: TreeElementProps) {
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const [isExpanded, setIsExpanded] = useState(true);
  const pinnedUniqueChildren = Array.from(
    new Set(
      [...object.pinnedRelationsWithPositions]
        .filter(({ relation }) => relation.from.id === object.id)
        .map(({ relation }) => relation.to),
    ),
  );
  const uniqueChildren = [...new Set(object.children)];

  const handleNavigation = useCallback(
    (action: () => void) => {
      action();
      if (window.innerWidth <= 450) {
        viewStore.toggleLeftSidebar();
      }
    },
    [viewStore],
  );

  const handleMainClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.shiftKey) {
        viewStore.createSidebarTree(object);
      } else if (e.metaKey) {
        openNewTab(object);
      } else {
        setIsExpanded(!isExpanded);
      }
    },
    [viewStore, object, openNewTab, isExpanded],
  );

  const handleChildClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => {
      if (e.shiftKey) {
        viewStore.createSidebarTree(child);
      } else if (e.metaKey) {
        openNewTab(child);
      } else {
        handleNavigation(() => setRoot(child));
      }
    },
    [viewStore, openNewTab, handleNavigation, setRoot],
  );

  return (
    <>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)} onPointerDown={handleMainClick}>
        <span>{object.text}</span>
        <div className={styles.IconBox}>
          <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
        </div>
      </div>
      <div className={styles.SidebarTreeChildren}>
        {isExpanded &&
          pinnedUniqueChildren.map((o) => (
            <Button variant="ghost" className={cn(styles.Button)} onClick={(e) => handleChildClick(e, o)} key={o.id}>
              {o.text}
            </Button>
          ))}
      </div>
      {isExpanded && pinnedUniqueChildren.length > 0 && <hr style={{ width: "80%", opacity: "0.3" }} />}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && uniqueChildren.length === 0 ? (
          <div className={styles.EmptyMessage}>No hashtags yet</div>
        ) : (
          isExpanded &&
          uniqueChildren.map((o) => (
            <Button variant="ghost" className={cn(styles.Button)} onClick={(e) => handleChildClick(e, o)} key={o.id}>
              {o.text}
            </Button>
          ))
        )}
      </div>
    </>
  );
});

export const MyHashtagsTree = observer(function SidebarTree() {
  const graphStore = useGraphStore();
  return (
    <div className={styles.SidebarTreeContainer}>
      <TreeElement object={graphStore.myHashtagsNode}></TreeElement>
    </div>
  );
});
