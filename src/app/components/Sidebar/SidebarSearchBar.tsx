import { Search } from "lucide-react";
import React, { useCallback, useRef } from "react";

import styles from "./SidebarTree.module.css";

interface SidebarSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  placeholder?: string;
}

export function SidebarSearchBar({ searchQuery, setSearchQuery, placeholder = "Search..." }: SidebarSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        // Clear the search query
        setSearchQuery("");
        // Unfocus the input
        inputRef.current?.blur();
      }
    },
    [setSearchQuery],
  );

  return (
    <div className={styles.SearchContainer}>
      <div className={styles.SearchInputWrapper}>
        <Search size={14} className={styles.SearchInputIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          className={`${styles.SearchInput} ${searchQuery ? styles.SearchInputActive : ''}`}
          style={{ outline: "none" }} // Disable blue outline when focused
        />
      </div>
    </div>
  );
}
