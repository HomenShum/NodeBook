import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./MyHashtagsTree.module.css";

interface TreeElementProps {
  object: GraphObject;
}

const TreeElement = observer(function TreeElement({ object }: TreeElementProps) {
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const [isExpanded, setIsExpanded] = useState(false);
  const uniqueChildren = [...new Set(object.children)];

  const handleNavigation = useCallback(
    (action: () => void) => {
      action();
      if (window.innerWidth <= 450) {
        viewStore.toggleLeftSidebar();
      }
    },
    [viewStore],
  );

  return (
    <>
      <div className={styles.SidebarTreeBlock}>
        <div className={styles.IconBox} onClick={() => uniqueChildren.length > 0 && setIsExpanded(!isExpanded)}>
          <Play
            size={7}
            fill="currentColor"
            className={cn(uniqueChildren.length === 0 && styles.IconInactive, isExpanded && styles.IconExpanded)}
          />
        </div>

        <div className={styles.SidebarTreeContent}>
          <span>{object.text}</span>
        </div>
      </div>
      <div className={styles.SidebarTreeChildren}>
        {isExpanded &&
          uniqueChildren.map((o) => (
            <Button
              variant="ghost"
              className={cn(styles.Button)}
              onClick={() => {
                handleNavigation(() => setRoot(o));
              }}
              key={o.id}
            >
              {o.text}
            </Button>
          ))}
      </div>
    </>
  );
});

export const MyHashtagsTree = observer(function SidebarTree() {
  const graphStore = useGraphStore();
  return (
    <div className={styles.SidebarTreeContainer}>
      <TreeElement object={graphStore.myHashtagsNode}></TreeElement>
    </div>
  );
});
