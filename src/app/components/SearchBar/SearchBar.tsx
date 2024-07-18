import { Search, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { useViewStore } from "@/app/view/useViewStore";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(() => {
  const viewStore = useViewStore();
  const [searchFocused, setSearchFocused] = useState(false);
  return (
    <div
      className={searchFocused ? styles.SearchFocus : styles.Search}
      onFocus={() => setSearchFocused(true)}
      onBlur={() => setSearchFocused(false)}
    >
      <Search className={styles.SearchIcon} size={16} strokeWidth={2.5} />
      <input
        type="search"
        placeholder="Search..."
        className={styles.SearchContent}
        value={viewStore.searchQuery}
        onChange={action((e) => {
          viewStore.setSearchQuery(e.target.value);
        })}
      />
      {viewStore.searchQuery && (
        <button
          onClick={action(() => {
            viewStore.setSearchQuery("");
          })}
        >
          <X size={18} className={styles.CancelSearch} />
        </button>
      )}
    </div>
  );
});
