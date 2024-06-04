import { GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { useGraphStore } from "@/app/model/useGraphStore";
import { observer } from "mobx-react-lite";
import { useRelationAtPath } from "./RelatedObjectContext";

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

export const RelatedObjectDetails = observer(() => {
  const graphStore = useGraphStore();
  const { object, relation, position } = useRelationAtPath();
  const bundles = graphStore.relationToBundles.get(relation.id);
  const parentZones = getParentZones(relation);

  return (
    <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
      {position && (
        <span style={{ color: "gray" }}>
          position: {position.int}-{position.frac}
        </span>
      )}
      <span style={{ color: "gray" }}>id: {object.id}</span>
      <span style={{ color: "gray" }}>relationId: {relation.id}</span>
      <span style={{ color: "gray" }}>createdAt: {object.createdAt.toISOString()}</span>
      {object instanceof GraphNode && object.isBundle && <span style={{ color: "gray" }}>#BUNDLE</span>}
      {object instanceof GraphNode && object.isZone && <span style={{ color: "gray" }}>#ZONE</span>}
      {bundles && <span style={{ color: "gray" }}>part of bundle: {bundles.map((b) => b.id).join(", ")}</span>}
      {parentZones.length > 0 && (
        <span style={{ color: "gray" }}>zones: {parentZones.map((z) => `${z.id}:"${z.text}"`).join(", ")}</span>
      )}
    </div>
  );
});
