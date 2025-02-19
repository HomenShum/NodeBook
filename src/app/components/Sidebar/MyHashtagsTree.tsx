import { Maximize2, Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import hashtagSidebarStyles from "./HashtagTree.module.css";
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
    (e: React.MouseEvent<HTMLButtonElement>) => {
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

  const handlePinClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => {
      e.stopPropagation();
      const relation = object.relations.find((r) => r.from.id === object.id && r.to.id === child.id);
      if (!relation) return;

      if (object.isRelationPinned(relation)) {
        object.unpinChildRelation(relation);
      } else {
        object.pinChildRelation(relation);
      }
    },
    [object],
  );

  return (
    <>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <span>{object.text}</span>
        <Button variant="ghost" className={styles.HeaderButton} onClick={handleMainClick}>
          <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
        </Button>
        <Button variant="ghost" className={styles.HeaderButton} onClick={() => setRoot(object)}>
          <Maximize2 size={16} />
        </Button>
      </div>
      <div className={styles.SidebarTreeChildren}>
        {isExpanded &&
          pinnedUniqueChildren.map((o) => (
            <div key={o.id} className={hashtagSidebarStyles.HashtagRow}>
              <Button variant="ghost" className={cn(styles.Button)} onClick={(e) => handleChildClick(e, o)}>
                {o.text}
              </Button>
              <Button
                variant="ghostSmooth"
                className={cn(hashtagSidebarStyles.PinButton, hashtagSidebarStyles.Pinned)}
                onClick={(e) => handlePinClick(e, o)}
              >
                <div className={hashtagSidebarStyles.PinIcon}>
                  <PinCustomIcon />
                </div>
              </Button>
            </div>
          ))}
      </div>
      {isExpanded && pinnedUniqueChildren.length > 0 && <hr style={{ width: "80%", opacity: "0.3" }} />}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && uniqueChildren.length === 0 ? (
          <div className={styles.EmptyMessage}>No hashtags yet</div>
        ) : (
          isExpanded &&
          uniqueChildren.map((o) => {
            const relation = object.relations.find((r) => r.from.id === object.id && r.to.id === o.id);
            return (
              <div key={o.id} className={hashtagSidebarStyles.HashtagRow}>
                <Button variant="ghost" className={cn(styles.Button)} onClick={(e) => handleChildClick(e, o)}>
                  {o.text}
                </Button>
                <Button
                  variant="ghostSmooth"
                  className={cn(hashtagSidebarStyles.PinButton, {
                    [hashtagSidebarStyles.Pinned]: relation && object.isRelationPinned(relation),
                    [hashtagSidebarStyles.Unpinned]: !relation || !object.isRelationPinned(relation),
                  })}
                  onClick={(e) => handlePinClick(e, o)}
                >
                  <div className={hashtagSidebarStyles.PinIcon}>
                    <PinCustomIcon />
                  </div>
                </Button>
              </div>
            );
          })
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
