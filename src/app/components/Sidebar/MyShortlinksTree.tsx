import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useSlugs } from "@/app/contexts/SlugContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { SidebarSearchBar } from "./SidebarSearchBar";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

export const MyShortlinksTree = observer(function MyShortlinksTree() {
  const settingsStore = useSettingsStore();
  const { sidebarExpandedMyShortlinks: isExpanded } = settingsStore;
  const { slugs, fetchAllSlugs } = useSlugs();
  const setRoot = useSetMainRoot();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAllSlugs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter slugs based on search query
  const filteredSlugs = Object.entries(slugs).filter(([nodeId, slug]) => {
    if (!searchQuery) return true;
    return slug.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleOnClick = async (e: React.MouseEvent<HTMLButtonElement>, nodeId: string) => {
    e.stopPropagation();

    // Ensure the node is loaded
    await graphStore.layerManager.loadWithIds([nodeId]);

    const node = graphStore.nodesById.get(nodeId);
    if (!node) {
      console.error("Node not found even after loading:", nodeId);
      return;
    }

    if (e.shiftKey) {
      viewStore.createSidePanelTree(node);
    } else {
      setRoot(node);
      router.push("/" + slugs[nodeId]);
    }
  };

  return (
    <div className={styles.SidebarTreeContainer}>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <div className={styles.HeaderLeft}>
          <span>My Shortlinks</span>
          <div className={styles.HeaderControls}>
            <Button
              variant="ghost"
              className={styles.IconButton}
              onClick={() => settingsStore.setSidebarExpandedMyShortlinks(!isExpanded)}
            >
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <SidebarSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search shortlinks..."
        />
      )}
      {isExpanded && (
        <div className={styles.SidebarTreeChildren}>
          {filteredSlugs.length === 0 ? (
            <div className={styles.EmptyMessage}>{searchQuery ? "No matching links found" : "No links yet"}</div>
          ) : (
            filteredSlugs.map(([nodeId, slug]) => (
              <Button
                onClick={(e) => handleOnClick(e, nodeId)}
                key={nodeId}
                variant="ghost"
                style={{
                  justifyContent: "flex-start",
                  padding: "8px",
                  width: "100%",
                }}
                className={cn(styles.Button)}
              >
                /{slug}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
