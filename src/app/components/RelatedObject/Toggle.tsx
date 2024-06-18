import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Dispatch, SetStateAction } from "react";

import { useTree } from "@/app/view/Outline";

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
        style={{
          backgroundColor: "white",
          border: "none",
          width: "0",
          height: "1rem",
          color: "var(--gray-8)",
          cursor: "pointer",
          userSelect: "none",
        }}
        className="relative right-[4px]"
        onClick={() => {
          if (isSearching) {
            setSearchExpansion(!searchExpansion);
          } else {
            tree.togglePathExpanded(pathToNodeStr);
          }
        }}
      >
        {isExpanded ? (
          <Play size={8} fill="currentColor" className="rotate-90" />
        ) : (
          <Play size={8} fill="currentColor" />
        )}
      </button>
    );
  },
);
