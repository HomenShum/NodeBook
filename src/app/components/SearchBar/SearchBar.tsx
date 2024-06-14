import { Search, X } from "lucide-react";
import { useState } from "react";
import { observer } from "mobx-react-lite";

import { useRenderController } from "@/app/render/useRenderController";

import styles from "./SearchBar.module.css";

export const SearchBar = observer(() => {
  const renderController = useRenderController();
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
        value={renderController.searchQuery}
        onChange={(e) => renderController.setSearchQuery(e.target.value)}
      />
      {renderController.searchQuery && (
        <button onClick={() => renderController.setSearchQuery("")}>
          <X size={18} className={styles.CancelSearch} />
        </button>
      )}
    </div>
  );
});
