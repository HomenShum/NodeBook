import { Search, X } from "lucide-react";
import { useCallback, useState } from "react";

import { useViewController } from "@/app/controller/useViewController";

import styles from "./SearchBar.module.css";

export const SearchBar = () => {
  const viewController = useViewController();
  const [inputText, setInputText] = useState(viewController.searchQuery);
  const [searchFocused, setSearchFocused] = useState(false);

  const handleTextChange = useCallback(
    (newText: string) => {
      // We have both this local state and the state in the ViewController in order to
      // make the input properly responsive. In the onChange event we update both.
      setInputText(newText);
      viewController.setSearchQuery(newText);
    },
    [viewController],
  );

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
        value={inputText}
        onChange={(e) => handleTextChange(e.target.value)}
      />
      {viewController.searchQuery && (
        <button onClick={() => viewController.setSearchQuery("")}>
          <X size={18} className={styles.CancelSearch} />
        </button>
      )}
    </div>
  );
};
