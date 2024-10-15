import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { cn } from "@/lib/utils";

import styles from "./SidebarTree.module.css";

interface Props {
  object: GraphObject;
}

const TreeElement = observer(function TreeElement({ object }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <>
      <div className={styles.SidebarTreeBlock}>
        <div 
          className={styles.IconBox} 
          onClick={() => object.children.length > 0 && setIsExpanded(!isExpanded)}
        >
          <Play
            size={7}
            fill="currentColor"
            className={cn(
              object.children.length === 0 && styles.IconInactive,
              isExpanded && styles.IconExpanded
            )}
          />
        </div>

        <div className={styles.SidebarTreeContent}>
          <span>{object.text}</span>
        </div>
      </div>
      <div className={styles.SidebarTreeChildren}>
        {isExpanded && object.children.map((o) => <TreeElement object={o} key={o.id}></TreeElement>)}
      </div>
    </>
  );
});

export default observer(function SidebarTree() {
  const graphStore = useGraphStore();
  return (
    <div className={styles.SidebarTreeContainer}>
      <TreeElement object={graphStore.homeRoot}></TreeElement>
    </div>
  );
});
