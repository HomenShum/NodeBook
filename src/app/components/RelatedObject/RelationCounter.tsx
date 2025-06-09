import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";

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
  let displayCount = 0;
  if (object instanceof GraphNode || object instanceof GraphRelation) {
    displayCount = Number(object.relationCount) - 1 || object.relations.length - 1 || -1;
  }

  if (displayCount <= 0) {
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
              onClick(e);
            }
          : undefined
      }
    >
      {displayCount}
    </div>
  );
};
