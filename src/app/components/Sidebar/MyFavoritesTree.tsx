import { Maximize2, Play, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { removeFromFavorites } from "@/app/graph/favorites";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { SidebarSearchBar } from "./SidebarSearchBar";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

interface TreeElementProps {
  object: GraphObject;
}

export const MyFavoritesList = observer(function MyFavoritesList() {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const openNewTab = useOpenNewTab();
  const setRoot = useSetMainRoot();

  const settingsStore = useSettingsStore();
  const { sidebarExpandedMyFavorites: isExpanded } = settingsStore;
  const [searchQuery, setSearchQuery] = useState("");

  const object = graphStore.myFavoritesNode;
  const uniqueChildren = [...new Set(object.children)];
  const hasFavorites = uniqueChildren.length > 0;

  // Filter children based on search query
  const filteredChildren = searchQuery
    ? uniqueChildren.filter((child) => child.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : uniqueChildren;

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

  return (
    <div className={styles.SidebarTreeContainer}>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <div className={styles.HeaderLeft}>
          <span>My Favorites</span>
          <div className={styles.HeaderControls}>
            <Button
              variant="ghost"
              className={styles.IconButton}
              onClick={() => settingsStore.setSidebarExpandedMyFavorites(!isExpanded)}
            >
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghostSmooth" className={styles.IconButton} onClick={(e) => handleMaximizeClick(e)}>
                    <Maximize2 size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" sideOffset={8}>
                  Open in Main View
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      {isExpanded && hasFavorites && (
        <SidebarSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search favorites..." />
      )}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && filteredChildren.length === 0 ? (
          <div className={styles.EmptyMessage}>{searchQuery ? "No matching favorites found" : "No favorites yet"}</div>
        ) : (
          isExpanded && filteredChildren.map((o) => <FavoriteItem key={o.id} object={o} />)
        )}
      </div>
    </div>
  );
});

const FavoriteItem = observer(function FavoriteItem({ object }: TreeElementProps) {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();

  return (
    <div key={object.id} className={styles.TreeItem}>
      <Button
        variant="ghost"
        className={cn(styles.Button)}
        style={{ justifyContent: "flex-start" }}
        title={object.text}
        onClick={(e) => {
          if (e.shiftKey) {
            viewStore.createSidePanelTree(object);
          } else if (e.metaKey) {
            openNewTab(object);
          } else {
            setRoot(object);
            if (window.innerWidth <= 450) {
              viewStore.toggleLeftSidebar();
            }
          }
        }}
      >
        {object.text}
      </Button>
      <div className={styles.TreeItemButtons}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghostSmooth"
                className={cn(styles.IconButton)}
                onClick={(e) => removeFromFavorites(graphStore, object)}
                aria-label="Remove from favorites"
              >
                <X size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={4}>
              Remove from favorites
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});
