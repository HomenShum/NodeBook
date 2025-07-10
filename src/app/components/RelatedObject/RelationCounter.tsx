import { observer } from "mobx-react-lite";

import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphObject } from "@/app/graph/GraphObject";
import { DescendantTreeNode } from "@/app/tree/nodes";

import styles from "./styles/RelatedObjectView.module.css";

export const RelationCounter = observer(
  ({
    treeNodeOrGraphObject,
    onClick,
    showTooltip = true,
  }: {
    treeNodeOrGraphObject: DescendantTreeNode | GraphObject;
    onClick?: (e: React.MouseEvent) => void;
    showTooltip?: boolean;
  }) => {
    let object;
    let parentRelationId;
    if (treeNodeOrGraphObject instanceof DescendantTreeNode) {
      object = treeNodeOrGraphObject.object;
      parentRelationId = treeNodeOrGraphObject.parent.relationWithParent?.id;
    } else {
      object = treeNodeOrGraphObject;
      parentRelationId = null;
    }
    let displayCount = 0;
    // Get number of non-parent hidden relations
    if (object instanceof GraphNode || object instanceof GraphRelation) {
      displayCount = Number(object.relationCount) - 1 || object.relations.length - 1 || -1;
    }

    if (treeNodeOrGraphObject instanceof DescendantTreeNode) {
      const numHiddenRelations = object.relations.filter(
        (r: GraphRelation) => r.id !== parentRelationId && treeNodeOrGraphObject.tree.isFilteredRelation(r.id),
      ).length;
      displayCount = displayCount - numHiddenRelations;
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
  },
);
