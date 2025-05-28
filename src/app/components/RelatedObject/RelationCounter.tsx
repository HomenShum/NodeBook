import { GraphObject } from "@/app/graph/GraphObject";

import styles from "./styles/RelatedObjectView.module.css";

export const RelationCounter = ({
  object,
  onClick,
  showTooltip = true,
}: {
  object: GraphObject;
  onClick?: (e: React.MouseEvent) => void;
  showTooltip?: boolean;
}) => {
  const relationCount = object.relations.length - 1;

  if (relationCount <= 0) {
    // Return empty div to avoid layout shift
    return <div className={styles.RelationCounter} />;
  }

  return (
    <div
      data-tooltip="Direct relations"
      className={`${styles.RelationCounter} ${showTooltip && styles.showTooltip}`}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(e);
            }
          : undefined
      }
    >
      {relationCount}
    </div>
  );
};
