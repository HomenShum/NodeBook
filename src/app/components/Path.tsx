import { ObjectPath, objectPathToObjects, truncateText } from "@/app/util";
import { cn } from "@/lib/utils";

import styles from "./Path.module.css";

export const Path = ({ path }: { path: ObjectPath }) => {
  const objectsInPath = objectPathToObjects(path);
  if (!objectsInPath || objectsInPath.length === 1) return null;
  return (
    <div className={styles.Path}>
      {objectsInPath.map(({ text }, index) => {
        const isLast = index === objectsInPath.length - 1;
        return (
          <span key={index} className={cn(styles.PathItem, isLast ? styles.Wrap : styles.NoWrap)}>
            <span className={isLast ? cn(styles.Wrap, styles.MWFull) : cn(styles.NoWrap, styles.MWAuto)}>
              {isLast ? text : truncateText(text, 36)}
            </span>
            {index < objectsInPath.length - 1 && <span>/</span>}
          </span>
        );
      })}
    </div>
  );
};
