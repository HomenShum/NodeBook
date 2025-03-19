import { useVirtualizer } from "@tanstack/react-virtual";
import { Maximize2, Play, Search } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useRef } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from '@/app/contexts/SettingsStoreContext';
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

// Maximum depth for traversing relations
const MAX_TRAVERSAL_DEPTH = 3;

interface TreeElementProps {
  object: GraphObject;
  currentDepth?: number;
}

const TreeElement = observer(function TreeElement({ object, currentDepth = 0 }: TreeElementProps) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const settingsStore = useSettingsStore();
  const { sidebarExpandedLocalMentions: isExpanded } = settingsStore;
  const scrollParentRef = useRef<HTMLDivElement>(null);

  // Function to get mention nodes from forward traversal
  const getMentionNodes = useCallback((node: GraphNode, depth: number, visited = new Set<string>()): GraphNode[] => {
    if (depth >= MAX_TRAVERSAL_DEPTH || visited.has(node.id)) {
      return [];
    }

    visited.add(node.id);
    const mentions: GraphNode[] = [];

    // Get all forward relations
    const forwardRelations = Array.from(node.relationsWithPositions.values())
      .map(({ relation }) => relation)
      .filter((relation) => relation.from.id === node.id);

    // Process each forward relation
    for (const relation of forwardRelations) {
      const targetNode = relation.to;
      if (targetNode instanceof GraphNode) {
        // Check if the node has a mention in its content
        const isMentionNode = targetNode.content.some((chip) => chip.type === "mention");

        if (isMentionNode) {
          mentions.push(targetNode);
        }

        // Recursively traverse child and sublist relations
        if (
          relation.relationType.id === defaultRelationTypes.child.id ||
          relation.relationType.id === defaultRelationTypes.sublist.id
        ) {
          mentions.push(...getMentionNodes(targetNode, depth + 1, visited));
        }
      }
    }

    return Array.from(new Set(mentions));
  }, []);

  const localMentions = getMentionNodes(object as GraphNode, currentDepth);

  const virtualizer = useVirtualizer({
    count: localMentions.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36, // Approximate height of each mention button
    overscan: 5,
  });

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

      settingsStore.setSidebarExpandedLocalMentions(!isExpanded);
    },
    [isExpanded, settingsStore],
  );

  const handleChildClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => {
      if (e.shiftKey) {
        viewStore.createSidebarTree(child);
      } else if (e.metaKey) {
        openNewTab(child);
      } else {
        handleNavigation(() => {
          // Focus and update the search input first
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
          if (searchInput) {
            // Focus the input
            searchInput.focus();
            // Trigger a change event with the mention text
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            )?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(searchInput, child.text);
              searchInput.dispatchEvent(new Event("input", { bubbles: true }));
              searchInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
          // Enable deep searching
          viewStore.setDeepSearching(true);
        });
      }
    },
    [viewStore, openNewTab, handleNavigation],
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => {
      e.stopPropagation(); // Prevent button click propagation
      if (e.shiftKey) {
        viewStore.createSidebarTree(child);
      } else {
        setRoot(child);
      }
    },
    [setRoot, viewStore],
  );

  return (
    <>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <div className={styles.HeaderLeft}>
          <span>Local Mentions</span>
          <div className={styles.HeaderControls}>
            <Button variant="ghost" className={styles.HeaderButton} onClick={handleMainClick}>
              <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
          </div>
        </div>
      </div>
      <div
        ref={scrollParentRef}
        className={styles.SidebarTreeChildren}
        style={{
          height: "100%",
          overflow: "auto",
        }}
      >
        {isExpanded && localMentions.length === 0 ? (
          <div className={styles.EmptyMessage}>No local mentions found</div>
        ) : (
          isExpanded && (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const mention = localMentions[virtualRow.index];
                return (
                  <div
                    key={mention.id}
                    className={cn(styles.Button)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 8px",
                    }}
                  >
                    <Button
                      variant="ghost"
                      className="w-full h-full flex justify-between items-center"
                      onClick={(e) => handleChildClick(e, mention)}
                    >
                      <span style={{ textAlign: "left" }}>{mention.text}</span>
                      <div className={styles.IconsContainer}>
                        <Search size={14} className={styles.SearchIcon} />
                      </div>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={styles.ExpandButton}
                      onClick={(e) => handleExpandClick(e, mention)}
                    >
                      <Maximize2 size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
});

export const LocalMentionsTree = observer(function LocalMentionsTree() {
  const viewStore = useViewStore();
  const currentNode = viewStore.mainView.rootObject;

  return (
    <div className={styles.SidebarTreeContainer}>
      <TreeElement object={currentNode}></TreeElement>
    </div>
  );
});
