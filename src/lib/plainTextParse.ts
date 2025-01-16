import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedGraphStore, SerializedNode } from "@/app/persistence/SerializedData";
import { uuid } from "@/app/util";

export const parsePlainTextUpload = (existingGraphStore: GraphStore, fileContent: string): SerializedGraphStore => {
  // In the plain text file uploads, content looks like this:
  //
  // -Node text
  //   -Child node text
  //   -Some non-child relation type::Related node text
  //   -Another child node text
  //     -Grandchild node text
  //  ...
  //
  // The whitespace is significant, and the indentation is always a hard tab character (\t) or two spaces (\s\s).
  // There will be one or more root level nodes, each with zero or more child nodes.

  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };

  const authorId = existingGraphStore.user.id;
  snapshot.usersById[authorId] = existingGraphStore.user;

  // Use a fixed timestamp for the entire import to make these nodes/relations easy to identify
  const importTs = Date.now();
  // Prefix all IDs with a unique string for the same reason
  const importIdPrefix = `import-${importTs}`;

  // Make temporary maps used for import logic
  const curNodeIdsByDepth: { [depth: number]: string } = {};
  const relationTypeIdsByLabel: { [label: string]: string } = {};
  const nodeIdsByText: { [text: string]: string } = {};
  const childCountByNodeId: { [nodeId: string]: number } = {};

  // Make a root node that all imported nodes will be children of
  const rootForImportId = `${importIdPrefix}-n-${uuid()}`;
  snapshot.nodesById[rootForImportId] = {
    id: rootForImportId,
    authorId: authorId,
    version: 1,
    createdAt: new Date(importTs),
    updatedAt: new Date(importTs),
    content: [{ type: "text", value: `Nodes imported ${new Date(importTs).toISOString()}` }],
    isPublic: false,
    isNewRelatedObjectsPublic: false,
    canonicalRelationId: null,
    isChecked: null,
  };
  curNodeIdsByDepth[-1] = rootForImportId;
  snapshot.relationsByNodeId[rootForImportId] = {};
  snapshot.pinnedRelationsByNodeId[rootForImportId] = {};
  snapshot.noteContentRelationsByNodeId[rootForImportId] = {};

  // Make a relation from the import root to the user's root node
  const importRootRelId = `${importIdPrefix}-r-${uuid()}`;
  snapshot.relationsById[importRootRelId] = {
    id: importRootRelId,
    authorId: authorId,
    version: 1,
    createdAt: new Date(importTs),
    updatedAt: new Date(importTs),
    fromId: existingGraphStore.userRootId,
    toId: rootForImportId,
    relationTypeId: "child",
    isPublic: false,
    canonicalRelationId: null,
  };
  snapshot.nodesById[rootForImportId].canonicalRelationId = importRootRelId;
  snapshot.relationsByNodeId[existingGraphStore.userRootId] = {};
  snapshot.relationsByNodeId[existingGraphStore.userRootId][importRootRelId] = {
    int: 0,
    frac: "a0",
  };
  snapshot.relationsByNodeId[rootForImportId][importRootRelId] = {
    int: 0,
    frac: "a0",
  };

  const lines = fileContent.split("\n");

  let depth = 0;
  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Count depth by counting leading tabs/space pairs
    depth = 0;
    while (line[depth] === "\t" || line.slice(depth * 2, depth * 2 + 2) === "  ") {
      depth++;
    }
    // Possible we have bad input where there's an indented line that doesn't properly match to a parent line.
    // If so, backtrack depth until we find a parent line, or we're at the root level.
    while (depth > 0 && !curNodeIdsByDepth[depth - 1]) {
      depth--;
    }

    // Trim leading whitespace
    const trimmedLine = line.trimStart();

    if (!trimmedLine.startsWith("-")) {
      throw new Error(`Invalid line: ${line}`);
    }

    // Line will start with a hyphen, immediately followed by either the node text or the relation type and a double colon.
    // Note we do this indexOf stuff rather than split so that we can support node text that has double colons in it.
    const relationTypeSplit = trimmedLine.indexOf("::");

    let nodeText = "";
    let relationTypeId = "";
    let isRelationReverse = false;

    if (depth === 0 || relationTypeSplit === -1) {
      // If at root level or no specified relation type, all text after the hyphen is node text and we force the relation type to be "child"
      nodeText = trimmedLine.slice(1);
      relationTypeId = "child";
      isRelationReverse = false;
    } else {
      // If there's a relation type, text before the double colon is the relation type, and text after is the node text
      const relationType = trimmedLine.slice(1, relationTypeSplit);
      nodeText = trimmedLine.slice(relationTypeSplit + 2).trim();

      if (relationTypeIdsByLabel[relationType]) {
        relationTypeId = relationTypeIdsByLabel[relationType];
        isRelationReverse = false;
      } else if (existingGraphStore.getRelationTypeByLabel(relationType)) {
        // If the relation type exists in the user's graph, use that
        const { relationType: existingGraphRelType, direction } =
          existingGraphStore.getRelationTypeByLabel(relationType)!;
        relationTypeId = existingGraphRelType.id;
        isRelationReverse = direction === "reverse";
      } else {
        // Create relation type if it doesn't exist
        relationTypeId = `${importIdPrefix}-rt-${uuid()}`;
        let label = relationType;
        let reverseLabel = "";
        if (label.endsWith(" of")) {
          reverseLabel = label;
          label = label.replace(/^(is\s+)?(.+?)\s+of$/i, "$2");
          isRelationReverse = true;
        } else {
          reverseLabel = `is ${label} of`;
          isRelationReverse = false;
        }
        snapshot.relationTypesById[relationTypeId] = {
          id: relationTypeId,
          authorId: authorId,
          version: 1,
          label: label,
          reverseLabel: reverseLabel,
          isPublic: false,
        };
        relationTypeIdsByLabel[label] = relationTypeId;
      }
    }

    let nodeId = "";
    const parentId = curNodeIdsByDepth[depth - 1];
    const relId = `${importIdPrefix}-r-${uuid()}`;

    if (nodeIdsByText[nodeText]) {
      // Reuse existing node if we've already seen this text
      nodeId = nodeIdsByText[nodeText];
    } else {
      // Create the node
      nodeId = `${importIdPrefix}-n-${uuid()}`;
      const node: SerializedNode = {
        id: nodeId,
        authorId: authorId,
        version: 1,
        createdAt: new Date(importTs),
        updatedAt: new Date(importTs),
        content: [{ type: "text", value: nodeText }],
        isPublic: false,
        isNewRelatedObjectsPublic: false,
        canonicalRelationId: relId,
        isChecked: null,
      };
      snapshot.nodesById[nodeId] = node;
      nodeIdsByText[nodeText] = nodeId;
    }

    curNodeIdsByDepth[depth] = nodeId;

    // Create a relation from the parent node to this node
    snapshot.relationsById[relId] = {
      id: relId,
      authorId: authorId,
      version: 1,
      createdAt: new Date(importTs),
      updatedAt: new Date(importTs),
      fromId: !isRelationReverse ? parentId : nodeId,
      toId: !isRelationReverse ? nodeId : parentId,
      relationTypeId: relationTypeId,
      isPublic: false,
      canonicalRelationId: null,
    };

    childCountByNodeId[parentId] = (childCountByNodeId[parentId] || 0) + 1;
    snapshot.relationsByNodeId[parentId][relId] = {
      int: childCountByNodeId[parentId],
      frac: "a0",
    };
    snapshot.relationsByNodeId[nodeId] = {};
    snapshot.relationsByNodeId[nodeId][relId] = {
      int: 0,
      frac: "a0",
    };
    snapshot.pinnedRelationsByNodeId[nodeId] = {};
    snapshot.noteContentRelationsByNodeId[nodeId] = {};
  }

  return snapshot;
};
