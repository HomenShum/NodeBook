import { uuid } from "@/app/util";

import { SerializedGraphStore } from "./SerializedData";

interface IdeapadNode {
  clientId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface IdeapadEdge {
  clientId: string;
  sourceIdeaClientId: string;
  targetIdeaClientId: string;
  labelText: string;
}

interface IdeapadSnapshot {
  nodes: IdeapadNode[];
  edges: IdeapadEdge[];
}

export function parseIdeapadData(data: IdeapadSnapshot, userId: string): SerializedGraphStore {
  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };

  // Convert nodes
  for (const node of data.nodes) {
    const nodeId = node.clientId;
    snapshot.nodesById[nodeId] = {
      id: nodeId,
      authorId: userId,
      version: 1,
      createdAt: new Date(node.createdAt),
      updatedAt: new Date(node.updatedAt),
      content: [{ type: "text", value: node.title }],
      isPublic: false,
      isNewRelatedObjectsPublic: false,
      canonicalRelationId: null,
      isChecked: null,
    };
    snapshot.relationsByNodeId[nodeId] = {};
    snapshot.pinnedRelationsByNodeId[nodeId] = {};
    snapshot.noteContentRelationsByNodeId[nodeId] = {};
  }

  // Convert edges and create relation types
  for (const edge of data.edges) {
    const relationTypeId = uuid();
    snapshot.relationTypesById[relationTypeId] = {
      id: relationTypeId,
      authorId: userId,
      version: 1,
      label: edge.labelText,
      reverseLabel: `is ${edge.labelText} of`,
      isPublic: false,
    };

    const relationId = edge.clientId;
    snapshot.relationsById[relationId] = {
      id: relationId,
      authorId: userId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      fromId: edge.sourceIdeaClientId,
      toId: edge.targetIdeaClientId,
      relationTypeId: relationTypeId,
      isPublic: false,
      canonicalRelationId: null,
    };

    snapshot.relationsByNodeId[edge.sourceIdeaClientId][relationId] = { int: 0, frac: "a0" };
    snapshot.relationsByNodeId[edge.targetIdeaClientId][relationId] = { int: 0, frac: "a0" };
  }

  return snapshot;
}
