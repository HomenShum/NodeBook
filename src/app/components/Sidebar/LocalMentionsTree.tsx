import { Maximize2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { TriangleIcon } from "@/app/components/CustomIcons";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { SidebarSearchBar } from "./SidebarSearchBar";

import styles1 from "./ResizableSidebar.module.css";
import styles from "./SidebarTree.module.css";

// Maximum depth for traversing relations
const MAX_TRAVERSAL_DEPTH = 5;
const MAX_SEARCH_SIZE = 1000;

interface TreeElementProps {
  object: GraphObject;
  currentDepth?: number;
}

interface MentionItemProps {
  mention: GraphObject;
  onChildClick: (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => void;
  onExpandClick: (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => void;
}

const MentionItem = observer(function MentionItem({ mention, onChildClick, onExpandClick }: MentionItemProps) {
  return (
    <div key={mention.id} className={styles.TreeItem}>
      <Button
        variant="ghost"
        className={cn(styles.Button)}
        style={{ justifyContent: "flex-start" }}
        title={mention.text}
        onClick={(e) => onChildClick(e, mention)}
      >
        {mention.text}
      </Button>
      <div className={styles.TreeItemButtons}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghostSmooth"
                className={cn(styles.IconButton)}
                onClick={(e) => onExpandClick(e, mention)}
                aria-label="Expand mention"
              >
                <Maximize2 size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={4}>
              Open in Main View
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

const TreeElement = observer(function TreeElement({ object, currentDepth = 0 }: TreeElementProps) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const settingsStore = useSettingsStore();
  const { sidebarExpandedLocalMentions: isExpanded } = settingsStore;
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to get mention nodes from forward traversal
  const getMentionNodes = useCallback((node: GraphNode, depth: number, visited = new Set<string>()): GraphNode[] => {
    if (depth >= MAX_TRAVERSAL_DEPTH || visited.has(node.id) || visited.size >= MAX_SEARCH_SIZE) {
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

  const localMentions = useMemo(
    () => getMentionNodes(object as GraphNode, currentDepth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMentionNodes, object, currentDepth, refreshTrigger],
  );

  // Filter mentions based on search query
  const filteredMentions = useMemo(() => {
    if (!searchQuery) return localMentions;
    return localMentions.filter((mention) => mention.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [localMentions, searchQuery]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(intervalId);
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

      settingsStore.setSidebarExpandedLocalMentions(!isExpanded);
    },
    [isExpanded, settingsStore],
  );

  const handleChildClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, child: GraphObject) => {
      if (e.shiftKey) {
        viewStore.createSidePanelTree(child);
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
        viewStore.createSidePanelTree(child);
      } else {
        setRoot(child);
      }
    },
    [setRoot, viewStore],
  );

  const hasLocalMentions = localMentions.length > 0;

  return (
    <>
      <div className={cn(styles.SidebarTreeBlock, styles1.SidebarSectionHeader)}>
        <div className={styles.HeaderLeft}>
          <span>Mentions in this page</span>
          <div className={styles.HeaderControls}>
            <Button variant="ghost" className={styles.IconButton} onClick={handleMainClick}>
              <TriangleIcon size={9} className={cn(isExpanded && styles.IconExpanded)} />
            </Button>
          </div>
        </div>
      </div>
      {isExpanded && hasLocalMentions && (
        <SidebarSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search mentions..." />
      )}
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && filteredMentions.length === 0 ? (
          <div className={styles.EmptyMessage}>
            {searchQuery ? "No matching mentions found" : "No local mentions found"}
          </div>
        ) : (
          isExpanded &&
          filteredMentions.map((mention) => (
            <MentionItem
              key={mention.id}
              mention={mention}
              onChildClick={handleChildClick}
              onExpandClick={handleExpandClick}
            />
          ))
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
