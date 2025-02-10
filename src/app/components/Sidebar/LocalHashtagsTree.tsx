import { useVirtualizer } from "@tanstack/react-virtual";
import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
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
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollParentRef = useRef<HTMLDivElement>(null);

  // Function to get hashtag nodes from forward traversal
  const getHashtagNodes = useCallback((node: GraphNode, depth: number, visited = new Set<string>()): GraphNode[] => {
    if (depth >= MAX_TRAVERSAL_DEPTH || visited.has(node.id)) {
      return [];
    }

    visited.add(node.id);
    const hashtags: GraphNode[] = [];

    // Get all forward relations
    const forwardRelations = Array.from(node.relationsWithPositions.values())
      .map(({ relation }) => relation)
      .filter((relation) => relation.from.id === node.id);

    // Process each forward relation
    for (const relation of forwardRelations) {
      const targetNode = relation.to;
      if (targetNode instanceof GraphNode) {
        // If the node is a hashtag (starts with #), add it
        if (targetNode.text.startsWith("#")) {
          hashtags.push(targetNode);
        }
        // Recursively traverse child and sublist relations
        if (
          relation.relationType.id === defaultRelationTypes.child.id ||
          relation.relationType.id === defaultRelationTypes.sublist.id
        ) {
          hashtags.push(...getHashtagNodes(targetNode, depth + 1, visited));
        }
      }
    }

    return Array.from(new Set(hashtags));
  }, []);

  const localHashtags = getHashtagNodes(object as GraphNode, currentDepth);

  const virtualizer = useVirtualizer({
    count: localHashtags.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36, // Approximate height of each hashtag button
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
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <span>Local Hashtags</span>
        <Button variant="ghost" className={styles.HeaderButton} onClick={handleMainClick}>
          <Play size={8} fill="currentColor" className={cn(isExpanded && styles.IconExpanded)} />
        </Button>
      </div>
      <div
        ref={scrollParentRef}
        className={styles.SidebarTreeChildren}
        style={{
          height: "100%",
          overflow: "auto",
        }}
      >
        {isExpanded && localHashtags.length === 0 ? (
          <div className={styles.EmptyMessage}>No local hashtags found</div>
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
                const hashtag = localHashtags[virtualRow.index];
                return (
                  <Button
                    key={hashtag.id}
                    variant="ghost"
                    className={cn(styles.Button)}
                    onClick={(e) => handleChildClick(e, hashtag)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {hashtag.text}
                  </Button>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
});

export const LocalHashtagsTree = observer(function LocalHashtagsTree() {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const currentNode = viewStore.mainView.rootObject;

  return (
    <div className={styles.SidebarTreeContainer}>
      <TreeElement object={currentNode}></TreeElement>
    </div>
  );
});
