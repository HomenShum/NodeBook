import { SerializedGraphStore } from "@/app/persistence/SerializedData";

export const ImportReviewList = ({
  existingData,
  newData,
}: {
  existingData: SerializedGraphStore;
  newData: SerializedGraphStore;
}) => {
  const { nodesById: existingNodesById, relationTypesById: existingRelationTypesById } = existingData;

  const { nodesById: newNodesById, relationTypesById: newRelationTypesById } = newData;

  const existingNodeIds = new Set(Object.keys(existingData.nodesById));
  const existingRelationIds = new Set(Object.keys(existingData.relationsById));
  const existingRelationTypeIds = new Set(Object.keys(existingData.relationTypesById));

  const newNodes = Object.values(newData.nodesById).filter((node) => !existingNodeIds.has(node.id));
  const newRelations = Object.values(newData.relationsById).filter((relation) => !existingRelationIds.has(relation.id));
  const newRelationTypes = Object.values(newData.relationTypesById).filter(
    (type) => !existingRelationTypeIds.has(type.id),
  );

  const getNodeLabel = (nodeId: string) => {
    const node = newNodesById[nodeId] || existingNodesById[nodeId];
    return node?.content?.[0]?.value || "Unknown Node";
  };

  const getRelationTypeLabel = (typeId: string) => {
    const relationType = newRelationTypesById[typeId] || existingRelationTypesById[typeId];
    return relationType?.label || "Unknown Relation Type";
  };

  return (
    <div>
      <h3>Review New Objects</h3>
      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {newNodes.length > 0 && (
          <div>
            <h4>Nodes ({newNodes.length})</h4>
            <ul style={{ listStyleType: "circle" }}>
              {newNodes.slice(0, 100).map((node) => (
                <li key={node.id}>{getNodeLabel(node.id)}</li>
              ))}
            </ul>
          </div>
        )}
        {newRelations.length > 0 && (
          <div>
            <h4>Relations ({newRelations.length})</h4>
            <ul style={{ listStyleType: "circle" }}>
              {newRelations.slice(0, 100).map((relation) => (
                <li key={relation.id}>
                  {getNodeLabel(relation.fromId)} ― {getRelationTypeLabel(relation.relationTypeId)} →{" "}
                  {getNodeLabel(relation.toId)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {newRelationTypes.length > 0 && (
          <div>
            <h4>Relation Types ({newRelationTypes.length})</h4>
            <ul style={{ listStyleType: "circle" }}>
              {newRelationTypes.map((relationType) => (
                <li key={relationType.id}>{relationType.label}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
