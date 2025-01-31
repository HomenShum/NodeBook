import { objectPathToBreadcrumb } from "@/app/graph/utils";
import { ObjectPath, truncateText } from "@/app/util";
import { cn } from "@/lib/utils";

import styles from "./Path.module.css";

export const Path = ({ path, skipLast = false }: { path: ObjectPath; skipLast?: boolean }) => {
  const { endState } = path;
  const breadcrumbs = objectPathToBreadcrumb(path);
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
              {isLast ? crumb : truncateText(crumb, 36)}
            </span>
            {index < breadcrumbs.length - 1 && <span>/</span>}
          </span>
        );
      })}
    </div>
  );
};
