import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Dispatch, SetStateAction } from "react";

import { useGraphStore } from "@/app/graph/useGraphStore";
import { useViewStore } from "@/app/view/useViewStore";

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
    const graphStore = useGraphStore();
    const viewStore = useViewStore();
    const isExpanded = isSearching ? searchExpansion : viewStore.isPathExpanded(pathToNodeStr);
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
            viewStore.togglePathExpanded(pathToNodeStr);
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
