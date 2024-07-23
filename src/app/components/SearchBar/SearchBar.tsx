import { Search, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(() => {
  const viewStore = useViewStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsExpanded(!!viewStore.searchQuery);
  }, [viewStore.searchQuery]);

  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node) && !viewStore.searchQuery) {
      setIsExpanded(false);
    }
  };

  const handleCancelClick = action((e: React.MouseEvent) => {
    e.stopPropagation();
    viewStore.setSearchQuery("");
    setIsExpanded(false);
    inputRef.current?.blur();
  });

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isExpanded || e.target === containerRef.current) {
      inputRef.current?.focus();
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.focus();
  };

  const handleInputChange = action((e: React.ChangeEvent<HTMLInputElement>) => {
    viewStore.setSearchQuery(e.target.value);
  });

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
