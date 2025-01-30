import { ChevronRight, Globe, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import React from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { truncateText, useIsMobile } from "@/app/util";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/app/view/useViewStore";

import { default as s } from "./Breadcrumbs.module.css";

type BreadcrumbItemProps = {
  object: GraphObject;
  path: string;
  index: number;
  isRoot?: boolean;
  handleNavigation: (index: number) => void;
};

export const BreadcrumbItem = observer(function BreadcrumbItem({
  object,
  path,
  index,
  isRoot = false,
  handleNavigation,
}: BreadcrumbItemProps) {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const isMobile = useIsMobile();

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (event.shiftKey) {
      viewStore.createSidebarTree(object);
    } else {
      handleNavigation(index);
    }
  };

  return (
    <React.Fragment key={`${path}-${object.text}`}>
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
          <span className={cn({ [s.BlankContent]: !object.text })}>
            {truncateText(object.text || "(blank)", isMobile ? 10 : 32)}
          </span>
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
