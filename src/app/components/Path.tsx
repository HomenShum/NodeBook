import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { objectPathToBreadcrumb } from "@/app/graph/utils";
import { ObjectPath, truncateText } from "@/app/util";
import { cn } from "@/lib/utils";
import canonicalPathCacheStore from "@/stores/CanonicalPathCacheStore";
import userNameCacheStore from "@/stores/UserNameCacheStore";

import styles from "./Path.module.css";

export const Path = observer(function Path({
  path,
  skipLast = false,
  maxLength = 36,
}: {
  path: ObjectPath;
  skipLast?: boolean;
  maxLength?: number;
}) {
  const { endState } = path;
  const breadcrumbs = objectPathToBreadcrumb(path);
  const cachedAncestors = canonicalPathCacheStore.cache.get(path.object.id);
  const authorId = path.object.authorId;
  const userName = userNameCacheStore.getUserName(authorId);

  // Load user name if not cached - always call this hook
  useEffect(() => {
    if (
      !userName &&
      !userNameCacheStore.isMissing(authorId) &&
      (!endState || endState === "not-loaded") &&
      !breadcrumbs.length
    ) {
      userNameCacheStore.load([authorId]);
    }
  }, [authorId, userName, endState, breadcrumbs.length]);

  if ((!endState || endState === "not-loaded") && Array.isArray(cachedAncestors)) {
    return (
      <div className={styles.Path}>
        {cachedAncestors.map((ancestor, index) => {
          const isLast = index === cachedAncestors.length - 1;
          if (isLast && skipLast) return;
          return (
            <span key={index} className={cn(styles.PathItem, isLast ? styles.Wrap : styles.NoWrap)}>
              <span className={isLast ? cn(styles.Wrap, styles.MWFull) : cn(styles.NoWrap, styles.MWAuto)}>
                {isLast ? ancestor.label : truncateText(ancestor.label, maxLength)}
              </span>
              {index < cachedAncestors.length - 1 && <span>/</span>}
            </span>
          );
        })}
      </div>
    );
  }

  // If no canonical path is loaded, show the author name instead
  if ((!endState || endState === "not-loaded") && !breadcrumbs.length) {
    const displayText = userName || authorId;

    return (
      <div className={styles.Path}>
        <span className={cn(styles.PathItem, styles.Wrap)}>
          <span className={cn(styles.Wrap, styles.MWFull)}>Author: {displayText}</span>
        </span>
      </div>
    );
  }

  if (!breadcrumbs.length) return null;

  return (
    <div className={styles.Path}>
      {endState !== "root" && <span>... /</span>}
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        if (isLast && skipLast) return;
        return (
          <span key={index} className={cn(styles.PathItem, isLast ? styles.Wrap : styles.NoWrap)}>
            <span className={isLast ? cn(styles.Wrap, styles.MWFull) : cn(styles.NoWrap, styles.MWAuto)}>
              {isLast ? truncateText(crumb, maxLength + 10) : truncateText(crumb, maxLength)}
            </span>
            {index < breadcrumbs.length - 1 && <span>/</span>}
          </span>
        );
      })}
    </div>
  );
});
