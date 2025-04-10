import { Clock, List, Maximize2, Play, SortAsc } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { comparePositions } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { SidebarSearchBar } from "./SidebarSearchBar";

import hashtagSidebarStyles from "./HashtagTree.module.css";
import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

type SortType = "alphanumeric" | "created" | "tree";

interface TreeElementProps {
  object: GraphObject;
}

const TreeElement = observer(function TreeElement({ object }: TreeElementProps) {
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const settingsStore = useSettingsStore();
  const { sidebarExpandedMyHashtags: isExpanded } = settingsStore;

  const [sortType, setSortType] = useState<SortType>("alphanumeric");
  const [searchQuery, setSearchQuery] = useState("");

  const pinnedUniqueChildren = Array.from(
    new Set(
      [...object.pinnedRelationsWithPositions]
        .filter(({ relation }) => relation.from.id === object.id)
        .map(({ relation }) => relation.to),
    ),
  );

  const sortNodes = (nodes: GraphObject[]) => {
    if (sortType === "tree") {
      return nodes
        .map((node) => {
          const relationWithPos = [...object.relationsWithPositions].find(
            ({ relation }) => relation.from.id === object.id && relation.to.id === node.id,
          );
          return { node, position: relationWithPos?.position ?? null };
        })
        .sort((a, b) => comparePositions(a.position, b.position))
        .map(({ node }) => node);
    }
    return [...nodes].sort((a, b) => {
      if (sortType === "alphanumeric") {
        return a.text.localeCompare(b.text);
      } else {
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      }
    });
  };

  const uniqueChildren = sortNodes(object.children);
  const sortedPinnedChildren = sortNodes(pinnedUniqueChildren);

  // Filter children based on search query
  const filteredUniqueChildren = searchQuery
    ? uniqueChildren.filter((child) => child.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : uniqueChildren;

  const filteredPinnedChildren = searchQuery
    ? sortedPinnedChildren.filter((child) => child.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedPinnedChildren;

  const toggleSort = useCallback(() => {
    setSortType((current) => {
      if (current === "alphanumeric") return "created";
      if (current === "created") return "tree";
      return "alphanumeric";
    });
  }, []);

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
        settingsStore.setSidebarExpandedMyHashtags(!isExpanded);
      }
    },
    [viewStore, object, openNewTab, isExpanded, settingsStore],
  );

  const handleMaximizeClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (e.shiftKey) {
        viewStore.createSidebarTree(object);
      } else if (e.metaKey) {
        openNewTab(object);
      } else {
        setRoot(object);
      }
    },
    [viewStore, object, openNewTab, setRoot],
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
        <div className={styles.HeaderLeft}>
          <span>{object.text}</span>

          <div className={styles.HeaderControls}>
            <Button variant="ghost" className={styles.HeaderButton} onClick={handleMainClick}>
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
            <Button variant="ghost" className={styles.HeaderButton} onClick={(e) => handleMaximizeClick(e)}>
              <Maximize2 size={16} />
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          className={styles.HeaderButton}
          onClick={toggleSort}
          title={`Sort by ${
            sortType === "alphanumeric" ? "creation date" : sortType === "created" ? "tree view order" : "name"
          }`}
        >
          {sortType === "alphanumeric" ? (
            <SortAsc size={14} />
          ) : sortType === "created" ? (
            <Clock size={14} />
          ) : (
            <List size={14} />
          )}
        </Button>
      </div>
      {isExpanded && (
        <SidebarSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search hashtags..." />
      )}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded &&
          filteredPinnedChildren.map((o) => (
            <div key={o.id} className={hashtagSidebarStyles.HashtagRow}>
              <Button
                variant="ghost"
                style={{ justifyContent: "flex-start" }}
                className={cn(styles.Button)}
                onClick={(e) => handleChildClick(e, o)}
              >
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
              <span className={styles.NodeCount}>{o.relations.length - 1}</span>
            </div>
          ))}
      </div>
      {isExpanded && filteredPinnedChildren.length > 0 && (
        <div style={{ paddingLeft: "20px", width: "100%" }}>
          <hr style={{ width: "100%", opacity: "0.3", margin: "4px 0" }} />
        </div>
      )}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && filteredUniqueChildren.length === 0 ? (
          <div className={styles.EmptyMessage}>{searchQuery ? "No matching hashtags found" : "No hashtags yet"}</div>
        ) : (
          isExpanded &&
          filteredUniqueChildren.map((o) => {
            const relation = object.relations.find((r) => r.from.id === object.id && r.to.id === o.id);
            return (
              <div key={o.id} className={hashtagSidebarStyles.HashtagRow}>
                <Button
                  variant="ghost"
                  style={{ justifyContent: "flex-start" }}
                  className={cn(styles.Button)}
                  onClick={(e) => handleChildClick(e, o)}
                >
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
                <span className={styles.NodeCount}>{o.relations.length - 1}</span>
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
