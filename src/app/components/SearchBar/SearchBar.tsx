import { Search, X } from "lucide-react";
import { useState } from "react";

import { useViewController } from "@/app/controller/useViewController";

import { observer } from "mobx-react-lite";
import styles from "./SearchBar.module.css";

export const SearchBar = observer(() => {
  const viewController = useViewController();
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
        value={viewController.searchQuery}
        onChange={(e) => viewController.setSearchQuery(e.target.value)}
      />
      {viewController.searchQuery && (
        <button onClick={() => viewController.setSearchQuery("")}>
          <X size={18} className={styles.CancelSearch} />
        </button>
      )}
    </div>
  );
});
