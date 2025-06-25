import { ChevronRight, Globe, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import React from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { truncateText, useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import { useTree } from "@/app/tree/TreeContext";

import { default as s } from "./Breadcrumbs.module.css";

type BreadcrumbItemProps = {
  object: GraphObject;
  index: number;
  handleNavigation: (index: number) => void;
};

export const BreadcrumbItem = observer(function BreadcrumbItem({
  object,
  index,
  handleNavigation,
}: BreadcrumbItemProps) {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const isMobile = useIsMobile();
  const tree = useTree();
  const isRoot = object.id === tree.rootObjectId;

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (event.shiftKey) {
      viewStore.createSidePanelTree(object);
    } else {
      handleNavigation(index);
    }
  };

  return (
    <React.Fragment key={object.id}>
      {index > 0 && <ChevronRight size={12} strokeWidth={2} className={s.Separator} />}

      <span className={s.Breadcrumb} onClick={handleClick}>
        {object.id === graphStore.globalRoot.id ? (
          <span className={s.Icon}>
            <Globe size={14} strokeWidth={1.5} />
          </span>
        ) : object.id === graphStore.homeRoot.id ? (
          <span className={s.Icon}>
            <Home size={14} strokeWidth={1.5} />
          </span>
        ) : null}
        {/* hide the GlobalRoot text on mobile when inside other paths */}
        {(isRoot || object.id !== graphStore.globalRoot.id || !isMobile) && (
          <span className={cn({ [s.BlankContent]: !object.text })}>{truncateText(object.text || "(blank)", 32)}</span>
        )}
        {/* don't show the pill when inside user and global root */}
        {!isMobile && isRoot && object.id !== graphStore.globalRoot.id && object.id !== graphStore.homeRoot.id && (
          <span>
            {object.isPublic ? (
              <div className={cn(s.PublicColor, s.PublishingStatusPill)}>Public</div>
            ) : (
              <div className={cn(s.PrivateColor, s.PublishingStatusPill)}>Private</div>
            )}
          </span>
        )}
      </span>
    </React.Fragment>
  );
});
