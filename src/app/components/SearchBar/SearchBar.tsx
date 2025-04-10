import { Search, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { env } from "@/app/envFrontend";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(function SearchBar() {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const [isExpanded, setIsExpanded] = useState(!!viewStore.searchQuery);
  const [visibleInput, setVisibleInput] = useState("");
  const [lastInputTime, setLastInputTime] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!containerRef.current?.contains(e.relatedTarget as Node) && !viewStore.searchQuery) {
        setIsExpanded(false);
        // Only cancel deep search if there's no search query, which is already handled by the condition above
        viewStore.cancelDeepSearch();
      }
    },
    [viewStore],
  );

  const handleCancelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      viewStore.cancelDeepSearch();
      setVisibleInput("");
      setIsExpanded(false);
      inputRef.current?.blur();
    },
    [viewStore],
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      viewStore.searchView.setFocusedNode(null);
      if (!isExpanded || e.target === containerRef.current) {
        inputRef.current?.focus();
      }
    },
    [isExpanded, viewStore],
  );

  // Listen for search input updates
  useEffect(() => {
    const handleSearchUpdate = (e: CustomEvent<string>) => {
      setVisibleInput(e.detail);
      setIsExpanded(e.detail !== "");
    };

    window.addEventListener("update-search-input", handleSearchUpdate as EventListener);
    return () => {
      window.removeEventListener("update-search-input", handleSearchUpdate as EventListener);
    };
  }, []);

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVisibleInput(e.target.value);
    setLastInputTime(new Date());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (new Date().getTime() - lastInputTime.getTime() > 400 && viewStore.searchQuery !== visibleInput) {
        //Todo: internally this calls graphStore.search which triggers a layerManager.loadWithText call.
        viewStore.setSearchQuery(visibleInput);
        // Only set deepSearching to true if there's a non-empty search query
        viewStore.setDeepSearching(visibleInput.trim().length > 0);
        graphStore.layerManager.loadWithBFS(viewStore.mainView.rootObjectId);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [viewStore, visibleInput, lastInputTime, graphStore.layerManager]);

  useEffect(() => {
    // Clear any existing search highlights when the search query changes
    if (CSS.highlights) {
      CSS.highlights.set("text-highlights", new Highlight());
    }
  }, [viewStore.searchQuery, graphStore.nodesById]);

  return (
    <div
      ref={containerRef}
      className={cn(styles.Search, {
        [styles.SearchExpanded]: isExpanded,
      })}
      onClick={handleContainerClick}
    >
      <div className={styles.SearchIconWrapper} onClick={handleIconClick}>
        <Search className={styles.SearchIcon} size={14} strokeWidth={1.5} />
      </div>
      <input
        ref={inputRef}
        type="search"
        placeholder={
          isExpanded
            ? `Search... ${" ".repeat(20)}Create (${env.isMac ? "⌘+Enter" : "Ctrl+Enter"})`
            : `Search... ( ${env.isMac ? "⌘+/" : "Ctrl+/"} )`
        }
        className={styles.SearchContent}
        value={visibleInput}
        onChange={handleInputChange}
        onFocus={() => {
          setIsExpanded(true);
          // Remove setting deepSearching on focus
          // Only set it based on whether there's a search query
          if (visibleInput.trim().length > 0) {
            viewStore.setDeepSearching(true);
          }
        }}
        onBlur={handleBlur}
        onKeyDown={action((e) => {
          if (e.key === "Escape") {
            // NOTE: Vimium will screw this up! It will override custom ESC behavior
            setIsExpanded(false);
            // Explicitly set deepSearching to false
            viewStore.cancelDeepSearch();
            setVisibleInput("");
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.nativeEvent.stopImmediatePropagation();
            viewStore.mainView.createChildOfRootAndFocus({
              nodeProps: { content: [{ type: "text", value: viewStore.searchQuery }] },
            });
            viewStore.setSearchQuery("");
          } else if (e.key === "k" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
            e.preventDefault();
            e.nativeEvent.stopImmediatePropagation();
            viewStore.mainView.createChildOfRootAndFocus({
              nodeProps: { content: [{ type: "text", value: "" }] },
            });
            viewStore.setSearchQuery("");
          }
        })}
      />
      {isExpanded && (
        <Button variant="ghost" className={styles.CancelSearch} onClick={handleCancelClick}>
          <X size={14} />
        </Button>
      )}
    </div>
  );
});
