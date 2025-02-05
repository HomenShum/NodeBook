import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";

import { CyclicIcon } from "@/app/components/CustomIcons";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { isNoteContent } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { useTreeNode } from "./RelatedObjectContext";
import objectViewStyles from "./styles/RelatedObjectView.module.css";
import styles from "./styles/Toggle.module.css";

const Toggle = observer(function Toggle() {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const settingsStore = useSettingsStore();
  const userId = graphStore.user?.id;
  const { treeNode } = useTreeNode();

  const handleToggleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      logger.debug("Clicked toggle", treeNode.path);

      const isMainTree =
        treeNode.tree.isMainTree ||
        treeNode.tree.id === viewStore.searchView.id ||
        treeNode.tree.id === viewStore.mainView.id;
      const isQuickCaptureTree =
        treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree;
      const isSidebarTree = !isMainTree && !isQuickCaptureTree;

      if (event.shiftKey && isSidebarTree) {
        treeNode.tree.togglePathExpanded(treeNode.path);
        return;
      }

      if (event.shiftKey && !isSidebarTree) {
        viewStore.createSidebarTree(treeNode.object);
        return;
      }

      if (!event.shiftKey && isSidebarTree) {
        treeNode.tree.togglePathExpanded(treeNode.path);
        return;
      }

      treeNode.tree.togglePathExpanded(treeNode.path);
    },
    [treeNode, viewStore],
  );

  const getAuthorName = (authorId: string) => {
    return graphStore.usersById.get(authorId)?.username || authorId;
  };

  const tooltipContent = `Node's author: ${treeNode.object.authorId === userId ? "You" : getAuthorName(treeNode.object.authorId)
    }
    Relation author: ${treeNode.relationWithParent.authorId === userId ? "You" : getAuthorName(treeNode.relationWithParent.authorId)
    }
    Created: ${new Date(treeNode.object.createdAt).toLocaleDateString()}
  `;
  const isEmpty = !treeNode.object.text.trim();
  const hasChildren = treeNode.childCount > 0;
  const isNoteContentRoot = isNoteContent(treeNode) && treeNode.parentGroup.id === "noteContent";
  return (
    <div
      className={cn(
        objectViewStyles.RelatedObjectBulletContainer,
        isEmpty && !hasChildren && !settingsStore.showBulletForEmptyNode && objectViewStyles.Hidden,
        isNoteContentRoot && objectViewStyles.NoteContentRootBullet,
      )}
      data-tooltip={tooltipContent}
    >
      {treeNode.instanceCountInPath <= 1 ? (
        // Default toggle button
        <button className={styles.ToggleButton} onPointerDown={(e) => handleToggleClick(e)}>
          <Play
            className={`${cn(styles.Icon, {
              [styles.IconNoChildren]: !hasChildren,
              [styles.IconHasChildren]: hasChildren,
              [styles.IconPublicNode]: treeNode.object.isPublic,
              [styles.IconPrivateNode]: !treeNode.object.isPublic,
            })}
            ${treeNode.isExpanded ? styles.ToggleExpanded : ""}`}
          />
        </button>
      ) : (
        // Hollow circle if this node has appeared in the path more than once
        <CyclicIcon
          className={cn(styles.Circle, { [styles.CirclePrivate]: !treeNode.object.isPublic })}
          //@ts-ignore
          onPointerDown={(event) => handleToggleClick(event)}
        />
      )}
    </div>
  );
});

export default Toggle;
