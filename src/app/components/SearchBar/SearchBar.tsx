import { Search, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(() => {
  const viewStore = useViewStore();
  const [isExpanded, setIsExpanded] = useState(!!viewStore.searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!containerRef.current?.contains(e.relatedTarget as Node) && !viewStore.searchQuery) {
        setIsExpanded(false);
      }
    },
    [viewStore],
  );

  const handleCancelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      viewStore.setSearchQuery("");
      setIsExpanded(false);
      inputRef.current?.blur();
    },
    [viewStore],
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isExpanded || e.target === containerRef.current) {
        inputRef.current?.focus();
      }
    },
    [isExpanded],
  );

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("handleInputChange", e.target, e.target.value);
      viewStore.setSearchQuery(e.target.value);
    },
    [viewStore],
  );

  return (
    <div
      ref={containerRef}
      className={cn(styles.Search, {
        [styles.SearchExpanded]: isExpanded,
      })}
      onClick={handleContainerClick}
    >
      <div className={styles.SearchIconWrapper} onClick={handleIconClick}>
        <Search className={styles.SearchIcon} size={14} strokeWidth={2.5} />
      </div>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search..."
        className={styles.SearchContent}
        value={viewStore.searchQuery}
        onChange={handleInputChange}
        onFocus={() => setIsExpanded(true)}
        onBlur={handleBlur}
        onKeyDown={action((e) => {
          if (e.key === "Escape") {
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
