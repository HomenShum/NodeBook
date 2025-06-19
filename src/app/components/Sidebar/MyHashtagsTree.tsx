import { Clock, List, Maximize2, Play, SortAsc } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
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

interface HashtagItemProps {
  hashtag: GraphObject;
  onChildClick: (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => void;
  onPinClick: (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => void;
  isPinned: boolean;
  relationCount: number;
}

const HashtagItem = observer(function HashtagItem({
  hashtag,
  onChildClick,
  onPinClick,
  isPinned,
  relationCount,
}: HashtagItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      key={hashtag.id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minWidth: 0,
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <Button
        variant="ghost"
        className={cn(styles.Button)}
        style={{ justifyContent: "flex-start" }}
        title={hashtag.text}
        onClick={(e) => onChildClick(e, hashtag)}
      >
        {hashtag.text}
      </Button>
      <div style={{ display: "flex", alignItems: "center" }}>
        {(isHovered || isPinned) && (
          <Button
            variant="ghostSmooth"
            className={cn(hashtagSidebarStyles.PinButton, {
              [hashtagSidebarStyles.Pinned]: isPinned,
              [hashtagSidebarStyles.Unpinned]: !isPinned,
            })}
            onClick={(e) => onPinClick(e, hashtag)}
            aria-label={isPinned ? "Unpin hashtag" : "Pin hashtag"}
          >
            <div className={hashtagSidebarStyles.PinIcon}>
              <PinCustomIcon size={11} />
            </div>
          </Button>
        )}
        <span className={styles.NodeCount}>{relationCount}</span>
      </div>
    </div>
  );
});

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
    ? uniqueChildren
        .filter((child) => child.text.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((child) => !pinnedUniqueChildren.some((pinned) => pinned.id === child.id))
    : uniqueChildren.filter((child) => !pinnedUniqueChildren.some((pinned) => pinned.id === child.id));

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
        viewStore.createSidePanelTree(object);
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
        viewStore.createSidePanelTree(object);
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
        viewStore.createSidePanelTree(child);
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
            <Button variant="ghost" className={styles.IconButton} onClick={handleMainClick}>
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
            <Button variant="ghostSmooth" className={styles.IconButton} onClick={(e) => handleMaximizeClick(e)}>
              <Maximize2 size={13} />
            </Button>
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghostSmooth" className={styles.IconButton} onClick={toggleSort}>
                {sortType === "alphanumeric" ? (
                  <SortAsc size={14} />
                ) : sortType === "created" ? (
                  <Clock size={14} />
                ) : (
                  <List size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={8}>
              Sort by{" "}
              {sortType === "alphanumeric" ? "creation date" : sortType === "created" ? "tree view order" : "name"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isExpanded && (
        <SidebarSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search hashtags..." />
      )}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded &&
          filteredPinnedChildren.map((o) => (
            <HashtagItem
              key={o.id}
              hashtag={o}
              onChildClick={handleChildClick}
              onPinClick={handlePinClick}
              isPinned={true}
              relationCount={
                o instanceof GraphNode || o instanceof GraphRelation ? o.relationCount : o.relations.length - 1
              }
            />
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
              <HashtagItem
                key={o.id}
                hashtag={o}
                onChildClick={handleChildClick}
                onPinClick={handlePinClick}
                isPinned={relation ? object.isRelationPinned(relation) : false}
                relationCount={
                  o instanceof GraphNode || o instanceof GraphRelation ? o.relationCount : o.relations.length - 1
                }
              />
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
