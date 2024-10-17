import { GraphObject } from "@/app/graph/GraphObject";

import styles from "./styles/RelationCounter.module.css";

export const RelationCounter = ({
  object,
  onClick,
  showTooltip = true,
}: {
  object: GraphObject;
  onClick?: () => void;
  showTooltip?: boolean;
}) => {
  const relationCount = object.relations.length - 1;

  if (relationCount <= 0) {
    return null;
  }

  return (
    <div
      data-tooltip="Direct relations"
      className={`${styles.RelationCounter} ${showTooltip && styles.showTooltip}`}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      {relationCount}
    </div>
  );
};
