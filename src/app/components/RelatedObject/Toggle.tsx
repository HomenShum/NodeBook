import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Dispatch, SetStateAction } from "react";

import { useTree } from "@/app/view/Tree";

import styles from "./Toggle.module.css";

export default observer(
  ({
    isSearching,
    searchExpansion,
    setSearchExpansion,
    pathToNodeStr,
  }: {
    searchExpansion: boolean;
    setSearchExpansion: Dispatch<SetStateAction<boolean>>;
    isSearching: boolean;
    pathToNodeStr: string;
  }) => {
    const tree = useTree();
    const isExpanded = isSearching ? searchExpansion : tree.isPathExpanded(pathToNodeStr);
    return (
      <button
        className={styles.ToggleButton}
        onClick={() => {
          if (isSearching) {
            setSearchExpansion(!searchExpansion);
          } else {
            tree.togglePathExpanded(pathToNodeStr);
          }
        }}
      >
        <Play size={8} className={`${styles.Icon} ${isExpanded ? styles.ToggleExpanded : ""}`} />
      </button>
    );
  },
);
