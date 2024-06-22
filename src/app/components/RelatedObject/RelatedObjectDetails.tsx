import { observer } from "mobx-react-lite";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import styles from "@/app/components/RelatedObject/RelatedObjectDetails.module.css";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { Position } from "@/app/util";

function getParentZones(relation: GraphRelation) {
  return Array.from(
    new Set(
      relation.relations
        .filter(
          (r) =>
            // is parent relation
            r.relationType.id === defaultRelationTypes.child.id &&
            r.to.id === relation.id &&
            // and parent is a zone
            r.from instanceof GraphNode &&
            r.from.isZone,
        )
        .map((r) => r.from),
    ),
  );
}

export const RelatedObjectDetails = observer(
  ({ position, object, relation }: { position: Position; object: GraphObject; relation: GraphRelation }) => {
    const graphStore = useGraphStore();
    const { treeNode } = useTreeNode();
    const bundles = graphStore.relationToBundles.get(relation.id);
    const parentZones = getParentZones(relation);

    return (
      <div className={styles.DetailsContainer}>
        <span>path: {treeNode.path} </span>
        <span>objectId: {object.id}</span>
        <span>relationId: {relation.id}</span>
        {position && (
          <span>
            position: {position.int}-{position.frac}
          </span>
        )}
        <span>createdAt: {object.createdAt.toISOString()}</span>
        {object instanceof GraphNode && object.isBundle && <span>#BUNDLE</span>}
        {object instanceof GraphNode && object.isZone && <span>#ZONE</span>}
        {bundles && <span>part of bundle: {bundles.map((b) => b.id).join(", ")}</span>}
        {parentZones.length > 0 && <span>zones: {parentZones.map((z) => `${z.id}:"${z.text}"`).join(", ")}</span>}
      </div>
    );
  },
);
