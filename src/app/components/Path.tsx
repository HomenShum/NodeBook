import { ObjectPath, objectPathToObjects, truncateText } from "@/app/util";

import styles from "./Path.module.css";

export const Path = ({ path }: { path: ObjectPath }) => {
  const objectsInPath = objectPathToObjects(path);
  if (!objectsInPath || objectsInPath.length === 1) return null;
  return (
    <div className={styles.Path}>
      {objectsInPath.map(({ text }, index) => (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: index === objectsInPath.length - 1 ? "wrap" : "nowrap",
          }}
          key={index}
        >
          <span
            style={{
              textWrap: index === objectsInPath.length - 1 ? "wrap" : "nowrap",
              maxWidth: index === objectsInPath.length - 1 ? "100%" : "auto",
            }}
          >
            {index === objectsInPath.length - 1 ? text : truncateText(text, 36)}
          </span>
          {index < objectsInPath.length - 1 && <span>/</span>}
        </span>
      ))}
    </div>
  );
};
