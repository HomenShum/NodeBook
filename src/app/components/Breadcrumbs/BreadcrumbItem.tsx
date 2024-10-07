import { ChevronRight, Globe, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import React from "react";

import { GraphObject } from "@/app/graph/GraphObject";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { truncateText, useIsMobile } from "@/app/util";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();

  return (
    <React.Fragment key={`${path}-${object.text}`}>
      {index > 0 && <ChevronRight size={12} strokeWidth={2} className={s.Separator} />}

      <span className={s.Breadcrumb} onClick={() => handleNavigation(index)}>
        {object.id === graphStore.globalRoot.id ? (
          <span className={s.Icon}>
            <Globe size={14} strokeWidth={1.5} />
          </span>
        ) : object.id === graphStore.userRoot.id ? (
          <span className={s.Icon}>
            <Home size={14} strokeWidth={1.5} />
          </span>
        ) : null}
        <span>{truncateText(isRoot ? object.text : object.text, isMobile ? 15 : 32)}</span>
        {isRoot && object.id !== graphStore.globalRoot.id && object.id !== graphStore.userRoot.id && (
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
