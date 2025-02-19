import { Maximize2, Play, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { removeFromFavorites } from "@/app/graph/favorites";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

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

  const [isExpanded, setIsExpanded] = useState(true);

  const object = graphStore.myFavoritesNode;
  const uniqueChildren = [...new Set(object.children)];

  return (
    <div className={styles.SidebarTreeContainer}>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <div className={styles.HeaderLeft}>
          <span>My Favorites</span>
          <div className={styles.HeaderControls}>
            <Button variant="ghost" className={styles.HeaderButton} onClick={() => setIsExpanded(!isExpanded)}>
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
            <Button
              variant="ghost"
              className={styles.HeaderButton}
              onClick={(e) => viewStore.createSidebarTree(object)}
            >
              <Maximize2 size={16} />
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && uniqueChildren.length === 0 ? (
          <div className={styles.EmptyMessage}>No favorites yet</div>
        ) : (
          isExpanded && uniqueChildren.map((o) => <FavoriteItem key={o.id} object={o} />)
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
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      key={object.id}
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
        title={object.text}
        onClick={(e) => {
          if (e.shiftKey) {
            viewStore.createSidebarTree(object);
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
      {isHovered && (
        <Button
          variant="ghost"
          onClick={(e) => removeFromFavorites(graphStore, object)}
          aria-label="Remove from favorites"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
});
