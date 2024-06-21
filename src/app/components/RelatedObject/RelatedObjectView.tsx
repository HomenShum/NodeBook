import { Circle, Dot, GlobeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import styles from "@/app/components/RelatedObject/RelatedObjectView.module.css";
import { PinCustom } from "@/app/components/icons";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { relationsToURLPath, useCurView } from "@/app/util";
import { DescendantTreeNode, getAncestorsAsArray, isUnlabelledChild, useTree } from "@/app/view/Tree";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { RelatedObjectChildren } from "./RelatedObjectChildren";
import { RelationAtPathProvider } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectEditor } from "./RelatedObjectEditor";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";
import { ViewTypeProvider } from "./ViewTypeContext";

/**
 * The view type of the related object. This determines what is displayed in the
 * related object view.
 * - `edit`: The default view where edits update the object content (or create a
 *   new object when it's rendered as a link)
 * - `replace`: The view where the user can replace the object with another
 *   object.
 */
export type RelatedObjectViewType = "edit" | "replace";

const canvas = document.createElement("canvas");

function getTextWidth(text: string, font: string) {
  const context = canvas.getContext("2d")!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export const RelatedObjectView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const settingsStore = useSettingsStore();
  const tree = useTree();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const curView = useCurView();
  const router = useRouter();

  const [updatingRelationType, setUpdatingRelationType] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [viewType, setViewType] = useState<RelatedObjectViewType>("edit");

  const handleBulletClick = useCallback(
    (e: React.MouseEvent) => {
      const path = getAncestorsAsArray(treeNode).map((p) => p.relationToChild);
      if (e.shiftKey) {
        logger.debug("Shift-clicked bullet", treeNode.path);
        viewStore.openSidebarOutlineView(path);
      } else {
        logger.debug("Clicked bullet", treeNode.path);
        switch (curView) {
          case ViewType.OUTLINE:
            router.push(`/outline${relationsToURLPath(path, graphStore)}`);
            break;
          case ViewType.THOUGHTSTREAM:
            router.push(`/stream${relationsToURLPath(path, graphStore)}`);
            break;
          case ViewType.SPLIT:
            tree.setRoot(path);
            break;
          default:
            curView satisfies never;
        }
      }
    },
    [tree, treeNode, curView, router, graphStore, viewStore],
  );

  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;
  const relationTypeTextWidth = showRelationType
    ? `${getTextWidth(`${treeNode.relationWithParent?.relationType.label}:`, "normal 17.5px ui-sans-serif") + 3}px`
    : "0px";
  const [relationComboboxIsOpen, setRelationComboboxIsOpen] = useState(false);

  return (
    <>
      <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
        <ViewTypeProvider value={{ viewType, setViewType }}>
          <RelationAtPathProvider
            value={{
              treeNode,
              openRelationTypeMenu: () => setRelationComboboxIsOpen(true),
            }}
          >
            <div
              className={cn(
                styles.RelatedObjectContent,
                !treeNode.object.isPrivate &&
                  settingsStore.hideThoughtstreamBullets &&
                  treeNode.parent.object === graphStore.thoughtstreamRoot && // TODO: what is this for?
                  styles.RelatedObjectContentPublic,
              )}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className={styles.RelatedObjectLeftArea} />
              {/* toggle, bullet, menu */}
              <div className={styles.RelatedObjectLeftHandler}>
                <div className={styles.RelatedObjectActions}>
                  {treeNode.childCount > 0 &&
                    // (treeNode.instanceCountInPath === 1 || !settingsStore.disableCycles) &&
                    isHovered && (
                      <Toggle
                        treeNode={treeNode}
                        // pathToNodeStr={treeNode.path}
                        // isSearching={!!searchResult}
                        // isSearching={false}
                        // searchExpansion={searchExpansion}
                        // setSearchExpansion={setSearchExpansion}
                      />
                    )}
                  <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
                </div>

                {treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) &&
                  graphStore.correspondingPinnedForObjects.has(treeNode.relationWithParent.id) && (
                    <button
                      className={styles.PinIcon}
                      onClick={() => treeNode.parent.object.unpinChildRelation(treeNode.relationWithParent)}
                    >
                      <PinCustom />
                    </button>
                  )}

                {!treeNode.object.isPrivate &&
                  settingsStore.hideThoughtstreamBullets &&
                  treeNode.parent.object === graphStore.thoughtstreamRoot && ( // TODO: what is this for?
                    <div className={styles.RelatedObjectPublic}>
                      <GlobeIcon size={12} strokeWidth={2} />
                    </div>
                  )}
              </div>

              <div
                className={cn(
                  styles.RelatedObjectBulletContainer,
                  // TODO this filtering should happen in the store
                  // settingsStore.hideThoughtstreamBullets && parent === graphStore.thoughtstreamRoot && styles.Hidden,
                )}
              >
                {treeNode.instanceCountInPath <= 1 ? (
                  // Default solid bullet
                  <>
                    <Dot
                      strokeWidth={5}
                      height={16}
                      className={cn(styles.Bullet, {
                        [styles.DotInsidePublic]: !treeNode.object.isPrivate,
                        [styles.DotInsidePrivate]: treeNode.object.isPrivate,
                      })}
                      onClick={handleBulletClick}
                    />
                    {treeNode.childCount > 0 && !treeNode.isExpanded && (
                      // with a shadow around it if it has children
                      // !showChildren &&
                      // (objectCount === 1 || !settingsStore.disableCycles) &&
                      // (!settingsStore.hideBulletBackgroundIfParentsOnly || hasNewChildren) && (
                      <Dot
                        height={16}
                        strokeWidth={17}
                        className={cn(styles.BulletShadow, {
                          [styles.DotOutsidePublic]: !treeNode.object.isPrivate,
                          [styles.DotOutsidePrivate]: treeNode.object.isPrivate,
                        })}
                      />
                    )}
                  </>
                ) : (
                  // Hollow circle if this node has appeared in the path more than once
                  <Circle
                    strokeWidth={6}
                    height={8}
                    className={cn(styles.Circle, { [styles.CirclePrivate]: treeNode.object.isPrivate })}
                    onClick={handleBulletClick}
                  />
                )}
              </div>

              {/* relation and node */}
              <div className={styles.RelatedObjectNode}>
                <div className={styles.RelatedObjectNodeContent}>
                  {showRelationType && (
                    <RelationCombobox
                      setUpdatingRelationType={setUpdatingRelationType}
                      treeNode={treeNode}
                      isOpen={relationComboboxIsOpen}
                      setIsOpen={setRelationComboboxIsOpen}
                    />
                  )}
                  {viewType === "replace" ? (
                    <ReplaceRelatedNodeView treeNode={treeNode} />
                  ) : (
                    <RelatedObjectEditor indentationWidth={relationTypeTextWidth} object={treeNode.object} />
                  )}
                </div>
                {settingsStore.showNodeDetails && viewType !== "replace" && (
                  <RelatedObjectDetails
                    position={treeNode.position}
                    object={treeNode.object}
                    relation={treeNode.relationWithParent}
                  />
                )}
              </div>
              {treeNode.object.relations.length > 1 && (
                <div className={styles.RelationCounter}>{treeNode.object.relations.length - 1}</div>
              )}
            </div>
          </RelationAtPathProvider>
        </ViewTypeProvider>
        {treeNode.children.length > 0 && <RelatedObjectChildren treeNode={treeNode} />}
      </div>
    </>
  );
});
