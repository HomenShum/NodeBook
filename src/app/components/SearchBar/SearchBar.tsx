import { Search, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { env } from "@/app/envFrontend";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(function SearchBar() {
  const viewStore = useViewStore();
  const [isExpanded, setIsExpanded] = useState(!!viewStore.searchQuery);
  const [visibleInput, setVisibleInput] = useState("");
  const [lastInputTime, setLastInputTime] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!containerRef.current?.contains(e.relatedTarget as Node) && !viewStore.searchQuery) {
        setIsExpanded(false);
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
        viewStore.setSearchQuery(visibleInput);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [viewStore, visibleInput, lastInputTime]);

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
        placeholder={isExpanded ? `Search... ${' '.repeat(20)}Create (${env.isMac ? "⌘+Enter" : "Ctrl+Enter"})` : "Search..."}
        className={styles.SearchContent}
        value={visibleInput}
        onChange={handleInputChange}
        onFocus={() => {
          setIsExpanded(true);
          viewStore.setDeepSearching(true);
        }}
        onBlur={handleBlur}
        onKeyDown={action((e) => {
          if (e.key === "Escape") {
            // NOTE: Vimium will screw this up! It will override custom ESC behavior
            setIsExpanded(false);
            viewStore.cancelDeepSearch();
            setVisibleInput("");
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            viewStore.mainView.createChildOfRootAndFocus({
              nodeProps: { content: [{ type: "text", value: viewStore.searchQuery }] },
            });
            viewStore.setSearchQuery("");
          } else if (e.key === "k" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
            e.preventDefault();
            viewStore.mainView.createChildOfRootAndFocus({
              nodeProps: { content: [{ type: "text", value: "" }] },
            });
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
