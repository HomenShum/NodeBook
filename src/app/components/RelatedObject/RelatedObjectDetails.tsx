import { observer } from "mobx-react-lite";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import styles from "@/app/components/RelatedObject/styles/RelatedObjectDetails.module.css";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { Position } from "@/app/util";

interface Props {
  position: Position;
  object: GraphObject;
  relation: GraphRelation;
}

export const RootObjectDetails = observer(function RootObjectDetails({ object }: { object: GraphObject }) {
  return (
    <div className={styles.DetailsContainer}>
      <span>objectId: {object.id}</span>
      <span>canonicalRelationId: {object.canonicalRelation?.id || "none"}</span>
    </div>
  );
});

export const RelatedObjectDetails = observer(function RelatedObjectDetails({ position, object, relation }: Props) {
  const { treeNode } = useTreeNode();
  return (
    <div className={styles.DetailsContainer}>
      <span className={styles.PathEllipsis}>path: {treeNode.path} </span>
      <span>objectId: {object.id}</span>
      <span>relationId: {relation.id}</span>
      <span>canonicalRelationId: {object.canonicalRelation?.id || "none"}</span>
      {position && (
        <span>
          position: {position.int}-{position.frac}
        </span>
      )}
      <span>createdAt: {object.createdAt.toISOString()}</span>
      <span>updatedAt: {object.updatedAt.toISOString()}</span>
      <span>relationCreatedAt: {relation.createdAt.toISOString()}</span>
      <span>relationUpdatedAt: {relation.updatedAt.toISOString()}</span>
    </div>
  );
});
