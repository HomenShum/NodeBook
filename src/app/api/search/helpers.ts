import { v4 as uuidv4 } from "uuid";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema";
import { AiEdge, AiGraph, AiNode, AiSearchStats, Completion } from "@/app/api/search/types";
import { SerializedNode, SerializedRelation } from "@/app/persistence/SerializedData";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * Format the query to be used by the AI before sending it to the LLM API.
 * Todo: Move some formatting logic from perplexitySearch to this method.
 */
const formatQuery = (query: string, addNodesInQueryTermToGraph: boolean = false) => {
  let newQuery = query;
  newQuery = newQuery.endsWith("?") ? newQuery : newQuery + "?";
  return newQuery;
};
export const uuid = () => uuidv4().slice(0, 8);

//Todo: Refactor this mess later
export async function perplexitySearch(query: string, addNodesInQueryTermToGraph: boolean = false): Promise<AiGraph> {
  let aiResponse = "";
  const generatedQuery = formatQuery(query, addNodesInQueryTermToGraph);
  const getItems = async (query: string, addNodesInQueryTermToGraph: boolean) => {
    const sonarProRaw = JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content:
            "Given a question asked by the user, you will answer in the following graph format. Example question: VCs into kite surfing. Give me a list of 10 individuals. Format output as JSON, in the following example format: [{ name: 'Sergei Brin', relationships: [{rel:'founder of', target:'Google'} , {rel:'partner at', target:'Gradient Ventures'}, whyRelevant:'Co-founder of Google, also known to enjoy kiteboarding' ]}, {name:'Roelof Botha', relationships: [ {rel:'partner at', target:'Sequoia'} ], whyRelevant:'Roelof went Kite Surfing with other VCs according to ABC news' },{name:'Georges Harik', relationships: [ {rel:'worked at', target:'Google'} ], whyRelevant:'Former Googler and angel investor, participant in the Mai Tai Kite Camp' }].Do not include any extra keys in JSON. Do not include any text before or after JSON. Output JSON on a single line. Do not add any line breaks or new lines (\n)." +
            (addNodesInQueryTermToGraph
              ? " Furthermore, very importantly, in addition to previous connections, extract one or two common theme such as interest or location from the user query, and add that relation target for each node."
              : ""),
        },
        {
          role: "user",
          content: generatedQuery,
        },
      ],
    });
    const sonarProResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: sonarProRaw,
      redirect: "follow",
    });

    if (!sonarProResponse.ok) {
      aiResponse += "sonar-pro: response not OK\n";
      throw new Error("Pro Response not OK, " + query);
    }

    const sonarProCompletion: Completion = await sonarProResponse.json();
    const sonarProMessage = sonarProCompletion.choices[0].message.content;

    let startIndex = sonarProMessage.indexOf("[");
    let endIndex = sonarProMessage.lastIndexOf("]");

    try {
      aiResponse = sonarProMessage;
      return JSON.parse(sonarProMessage.substring(startIndex, endIndex + 1));
    } catch (e) {
      aiResponse = "sonar-pro: json parsing error\n";
      console.log("JSON parsing error with sonar pro, piping output to base modal " + query);
    }

    const sonarBaseRaw = JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "Given data by user, you will format in the following graph format. Example input: Some Text or Paragraph. Format output as JSON, in the following example format: [{ name: 'Sergei Brin', relationships: [{rel:'founder of', target:'Google'} , {rel:'partner at', target:'Gradient Ventures'}, whyRelevant:'Co-founder of Google, also known to enjoy kiteboarding' ]}, {name:'Roelof Botha', relationships: [ {rel:'partner at', target:'Sequoia'} ], whyRelevant:'Roelof went Kite Surfing with other VCs according to ABC news' },{name:'Georges Harik', relationships: [ {rel:'worked at', target:'Google'} ], whyRelevant:'Former Googler and angel investor, participant in the Mai Tai Kite Camp' }].Do not include any extra keys in JSON. Do not include any text before or after JSON. Do not consult any internal or external data source, just work with the input. Output JSON on a single line. Do not add any line breaks or new lines (\n). Remove any brackets, parenthesis from the name or relation if they exist" +
            (addNodesInQueryTermToGraph
              ? " Furthermore, very importantly, in addition to previous connections, extract one or two common theme such as interest or location from the user query, and add that relation target for each node."
              : ""),
        },
        {
          role: "user",
          content: sonarProMessage,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "People",
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
                relationships: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rel: {
                        type: "string",
                      },
                      target: {
                        type: "string",
                      },
                    },
                    required: ["rel", "target"],
                  },
                },
                whyRelevant: {
                  type: "string",
                },
              },
              required: ["name", "relationships", "whyRelevant"],
            },
          },
        },
      },
    });
    const sonarBaseResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: sonarBaseRaw,
      redirect: "follow",
    });

    if (!sonarBaseResponse.ok) {
      aiResponse += "sonar: response not OK\n";
      throw new Error("Base Response not OK" + query);
    }

    const sonarBaseCompletion: Completion = await sonarBaseResponse.json();
    const sonarBaseMessage = sonarBaseCompletion.choices[0].message.content;

    startIndex = sonarBaseMessage.indexOf("[");
    endIndex = sonarBaseMessage.lastIndexOf("]");

    try {
      aiResponse += sonarBaseMessage;
      return JSON.parse(sonarBaseMessage.substring(startIndex, endIndex + 1));
    } catch (e) {
      aiResponse += "sonar: json parsing error\n";
      console.log("JSON parsing error with sonar base " + query, e);
      throw e;
    }
  };

  let items = [];

  try {
    items = await getItems(query, addNodesInQueryTermToGraph);
  } catch (e) {
    console.log(query, e);
    return {
      nodes: [],
      edges: [],
      aiResponse: aiResponse,
    };
  }

  const lowerCaseToPreservedCase: Record<string, string> = {};
  const nodeLabelToIdMap: Record<string, string> = {};
  const nodes: AiNode[] = [];
  const edges: AiEdge[] = [];

  //Clean up the items
  const regex = /[()[\]{}<>]/g;
  items = items.map((item: { name: string; relationships: any[] }) => {
    return {
      ...item,
      name: item.name.trim().replace(regex, ""),
      relationships: item.relationships.map((r) => ({
        ...r,
        rel: r.rel.trim().replace(regex, ""),
        target: r.target.trim().replace(regex, ""),
      })),
    };
  });

  for (const item of items) {
    lowerCaseToPreservedCase[item.name.toLowerCase()] = item.name;
    const labels = [];
    if (item.name.length > 0) {
      labels.push(item.name.toLowerCase());
    }
    for (const relationship of item.relationships) {
      lowerCaseToPreservedCase[relationship.target.toLowerCase()] = relationship.target;
      if (relationship.target.length > 0) {
        labels.push(relationship.target.toLowerCase());
      }
    }
    for (const label of labels) {
      if (!nodeLabelToIdMap[label]) {
        nodes.push({
          label,
          whyRelevant: item.whyRelevant || "",
        });
      }
    }
  }

  for (const item of items) {
    for (const relationship of item.relationships) {
      if (item.name.length > 0 && relationship.target.length > 0) {
        edges.push({
          relationship: relationship.rel,
          from: lowerCaseToPreservedCase[item.name.toLowerCase()], //source
          to: lowerCaseToPreservedCase[relationship.target.toLowerCase()],
        });
      }
    }
  }

  return {
    nodes: nodes.map((n) => {
      return { ...n, label: lowerCaseToPreservedCase[n.label] };
    }),
    edges,
    aiResponse,
  };
}

export async function deleteAllUnconfirmed(relationIds: string[]) {
  //Find all unconfirmed nodes
  //Find all incoming and outgoing connections
  //Figure out connection type
  //If labelled
  //delete _type_, _reverse_, _sublist_
  //Check if labelled nodes are being used somewhere else
  //If not delete
}

/**
 * Given the stringied content of a graph node, return the contents of first text chip.
 * Used for extracting relation labels stored as graph nodes.
 */
function extractLabel(content: string | null): string {
  if (!content) return "";
  try {
    const arr = JSON.parse(content) as { type: string; value: string }[];
    return arr.find((e) => e.type === "text")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Create a map, where the key is built from fromId, toId and the relation label.
 * Return the type of relation label as value. It's guaranteed that we would
 * query only the relation ids for which we know they are labelled.
 *
 * Format:
 *   "fromId_toId_label"  ->  "__type__" | "__reverse__"
 */
export async function getLabelledRelationMap(
  labelledRelationIds: string[],
): Promise<Map<string, "__type__" | "__reverse__">> {
  if (labelledRelationIds.length === 0) return new Map();
  const db = getDb();

  const t = alias(graphRelationTable, "t");
  const rev = alias(graphRelationTable, "rev");
  const l = alias(graphNodeTable, "l");
  const revL = alias(graphNodeTable, "revL");

  //handle forward
  const forward = await db
    .select({
      fromId: graphRelationTable.fromId,
      toId: graphRelationTable.toId,
      labelContent: graphNodeTable.content,
    })
    .from(graphRelationTable)
    .innerJoin(t, and(eq(t.fromId, graphRelationTable.id), eq(t.relationTypeId, "__type__")))
    .innerJoin(graphNodeTable, eq(graphNodeTable.id, t.toId))
    .where(inArray(graphRelationTable.id, labelledRelationIds));

  //handle reverse
  const reverse = await db
    .select({
      fromId: graphRelationTable.toId,
      toId: graphRelationTable.fromId,
      labelContent: revL.content,
    })
    .from(graphRelationTable)
    .innerJoin(t, and(eq(t.fromId, graphRelationTable.id), eq(t.relationTypeId, "__type__")))
    .innerJoin(l, eq(l.id, t.toId))
    .innerJoin(rev, and(eq(rev.fromId, l.id), eq(rev.relationTypeId, "__reverse__")))
    .innerJoin(revL, eq(revL.id, rev.toId))
    .where(inArray(graphRelationTable.id, labelledRelationIds));

  //merge into single map
  const map = new Map<string, "__type__" | "__reverse__">();

  forward.forEach((r) => {
    const label = extractLabel(r.labelContent);
    map.set(`${r.fromId}_${r.toId}_${label}`, "__type__");
  });

  reverse.forEach((r) => {
    const label = extractLabel(r.labelContent);
    map.set(`${r.fromId}_${r.toId}_${label}`, "__reverse__");
  });

  return map;
}

/**
 * Create relevant entries in database and returns information about the insertions.
 */
export const createEntities = async (
  aiNodes: AiNode[],
  edges: AiEdge[],
  userId: string,
  pageRootId: string,
  query: string,
  createQueryNode: boolean,
) => {
  //Todo: Handle duplicate meta node inserts
  //Todo: Wrap in transaction

  const aiTitleToNodeIdMap: Record<string, string> = {};
  const createdNodeIds = new Set<string>();
  const db = getDb();
  const authorId = userId;

  const queryNodeId = createQueryNode ? uuid() : pageRootId;

  //This does not take into account label nodes and connections between root tree node
  //and ai nodes
  const stats: AiSearchStats = {
    existingNodesCount: 0,
    nodeIdsExisting: [],
    newNodesCount: 0,
    existingConnectionCount: 0,
    newConnectionsCount: 0,
    queryNodeId,
    relationIdsInserted: [],
    nodeIdsInserted: [],
    metaIdsInserted: { nodeIds: [], relationIds: [] },
    nodeIdToRelevancy: {},
  };

  //Create a query node and add a relation to root tree node and query node.
  if (createQueryNode) {
    const queryRelationId = uuid();
    await db.insert(graphNodeTable).values({
      authorId: userId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      content: JSON.stringify([
        {
          type: "text",
          value: query,
        },
      ]),
      isPublic: true,
      isNewRelatedObjectsPublic: true,
      isChecked: null,
      accessMode: 0,
      attributes: {
        isAiGenerated: true,
      },
      id: queryNodeId,
    });
    await db.insert(graphRelationTable).values({
      id: queryRelationId,
      fromId: pageRootId,
      toId: queryNodeId,
      relationTypeId: "child",
      version: 1,
      authorId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: true,
      canonicalRelationId: queryRelationId,
      pk: uuidv4(),
    });
  }

  const inList = sql.join(
    aiNodes.map((n) => sql`${n.label}`),
    sql`, `,
  );

  const existingNodes = (
    await db.execute(sql`
    SELECT DISTINCT ON (tv.title)
           ${graphNodeTable}.id,
           tv.title
    FROM   ${graphNodeTable}
    LEFT JOIN LATERAL (
      SELECT string_agg(elem->>'value', ' ') AS title
      FROM   jsonb_array_elements(${graphNodeTable}.content::jsonb) AS elem
      WHERE  elem->>'type' = 'text'
    ) tv ON TRUE
    WHERE  tv.title IN (${inList})
    ORDER BY tv.title, ${graphNodeTable}.id          -- keep the first (smallest) id
  `)
  ).rows;

  (existingNodes as { id: string; title: string }[]).forEach((i) => {
    aiTitleToNodeIdMap[i.title] = i.id;
    const aiNode = aiNodes.find((aiNode) => aiNode.label == i.title);
    stats.nodeIdToRelevancy[i.id] = aiNode ? aiNode.whyRelevant : "Unknown";
    stats.nodeIdsExisting.push(i.id);
  });

  stats.existingNodesCount = existingNodes.length;

  //Create new nodes in database such that we have entry in database for each aiNode.
  const nodesToInsert = aiNodes
    .filter((aiNode) => !aiTitleToNodeIdMap[aiNode.label])
    .map((aiNode) => {
      const id = uuid();
      createdNodeIds.add(id);
      aiTitleToNodeIdMap[aiNode.label] = id;
      stats.nodeIdToRelevancy[id] = aiNode.whyRelevant;
      return {
        canonicalRelationId: null,
        authorId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: [
          {
            type: "text",
            value: aiNode.label,
          },
        ],
        isPublic: true,
        isNewRelatedObjectsPublic: true,
        isChecked: null,
        accessMode: 0,
        attributes: {
          isAiGenerated: true,
          whyRelevant: aiNode.whyRelevant,
          isConfirmed: false,
          query,
        },
        id,
      };
    });

  stats.newNodesCount = nodesToInsert.length;

  console.log(nodesToInsert, existingNodes, aiTitleToNodeIdMap, Object.values(aiTitleToNodeIdMap));

  if (nodesToInsert.length > 0) {
    await db.insert(graphNodeTable).values(
      nodesToInsert.map((n) => {
        return {
          ...n,
          content: JSON.stringify(n.content),
        };
      }),
    );
  }

  //Find all possible connections irrespective of directions, narrow down the directions later.
  const candidateRelations = await db
    .select({
      fromId: graphRelationTable.fromId,
      toId: graphRelationTable.toId,
      id: graphRelationTable.id,
      relation_type_id: graphRelationTable.relationTypeId,
    })
    .from(graphRelationTable)
    .where(
      or(
        inArray(graphRelationTable.fromId, Object.values(aiTitleToNodeIdMap)),
        inArray(graphRelationTable.toId, Object.values(aiTitleToNodeIdMap)),
      ),
    );

  // @ts-ignore
  const labelledRelationIds: string[] = (
    await db
      .selectDistinct({ id: graphRelationTable.fromId })
      .from(graphRelationTable)
      .where(
        inArray(
          graphRelationTable.fromId,
          candidateRelations.map((r) => r.id),
        ),
      )
  ).map((r) => r.id);

  const labelledRelationMap = await getLabelledRelationMap(labelledRelationIds);
  console.log("pool", labelledRelationMap, edges);

  const metaToInsert: { nodes: SerializedNode[]; relations: SerializedRelation[] } = { nodes: [], relations: [] };

  const incomingFreq: Record<string, number> = {};
  const outgoingFreq: Record<string, number> = {};

  const connectionsToInsert = edges
    .filter((edge) => {
      const key = `${aiTitleToNodeIdMap[edge.from]}_${aiTitleToNodeIdMap[edge.to]}_${edge.relationship}`;
      const relationTypeId = labelledRelationMap.get(key);

      if (relationTypeId) {
        stats.existingConnectionCount++;
        return false;
      }
      return true;
    })
    .map((edge: AiEdge) => {
      const fromId = aiTitleToNodeIdMap[edge.from];
      const toId = aiTitleToNodeIdMap[edge.to];
      if (outgoingFreq[fromId] === undefined) {
        outgoingFreq[fromId] = 0;
      }
      if (outgoingFreq[toId] === undefined) {
        outgoingFreq[toId] = 0;
      }
      if (incomingFreq[fromId] === undefined) {
        incomingFreq[fromId] = 0;
      }
      if (incomingFreq[toId] === undefined) {
        incomingFreq[toId] = 0;
      }
      outgoingFreq[fromId]++;
      incomingFreq[toId]++;
      const connectionId = uuid();
      const forwardLabelNodeId = uuid();
      const reverseLabelNodeId = uuid();
      const forwardRelationId = uuid();
      const reverseRelationId = uuid();
      const sublistRelationId = uuid();

      metaToInsert.nodes.push({
        authorId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: [
          {
            type: "text",
            value: edge.relationship,
          },
        ],
        isPublic: true,
        isNewRelatedObjectsPublic: true,
        isChecked: null,
        accessMode: 0,
        attributes: {
          isAiGenerated: true,
        },
        id: forwardLabelNodeId,
        canonicalRelationId: null,
      });

      metaToInsert.nodes.push({
        authorId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: [
          {
            type: "text",
            value: edge.relationship.endsWith(" of") ? edge.relationship.slice(0, -3) : edge.relationship + " of",
          },
        ],
        isPublic: true,
        isNewRelatedObjectsPublic: true,
        isChecked: null,
        accessMode: 0,
        attributes: {
          isAiGenerated: true,
        },
        id: reverseLabelNodeId,
        canonicalRelationId: null,
      });

      metaToInsert.relations.push({
        id: forwardRelationId,
        fromId: connectionId,
        toId: forwardLabelNodeId,
        relationTypeId: "__type__",
        version: 1,
        authorId: authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        canonicalRelationId: null,
      });

      metaToInsert.relations.push({
        id: reverseRelationId,
        fromId: forwardLabelNodeId,
        toId: reverseLabelNodeId,
        relationTypeId: "__reverse__",
        version: 1,
        authorId: authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        canonicalRelationId: null,
      });

      metaToInsert.relations.push({
        id: sublistRelationId,
        fromId: `user-relation-types-node-id-${authorId}`,
        toId: forwardLabelNodeId,
        relationTypeId: "sublist",
        version: 1,
        authorId: authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        canonicalRelationId: null,
      });

      return {
        id: connectionId,
        fromId: aiTitleToNodeIdMap[edge.from],
        toId: aiTitleToNodeIdMap[edge.to],
        relationTypeId: "child",
        version: 1,
        authorId: authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        canonicalRelationId: connectionId,
        pk: uuidv4(),
      };
    });

  stats.newConnectionsCount = connectionsToInsert.length;

  const connectionsToInsertFromQueryNode: SerializedRelation[] = [];

  const minIncomingFreq = Math.min(...Object.values(incomingFreq));

  for (const toId of [...Object.keys(incomingFreq), ...existingNodes.map((n) => n.id)] as string[]) {
    if ((incomingFreq[toId] || 0) <= minIncomingFreq) {
      const bridgeId = uuid();
      connectionsToInsertFromQueryNode.push({
        id: bridgeId,
        fromId: queryNodeId,
        toId,
        relationTypeId: "child",
        version: 1,
        authorId: authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        canonicalRelationId: bridgeId,
      });
    }
  }

  console.log(connectionsToInsert, metaToInsert, connectionsToInsertFromQueryNode);

  if (connectionsToInsert.length > 0) {
    await db.insert(graphRelationTable).values([...connectionsToInsert, ...connectionsToInsertFromQueryNode]);
    await db.insert(graphRelationTable).values(metaToInsert.relations);
    await db.insert(graphNodeTable).values(
      metaToInsert.nodes.map((n) => {
        return {
          ...n,
          content: JSON.stringify(n.content),
        };
      }),
    );
  }

  stats.relationIdsInserted = connectionsToInsert.map((r) => r.id);
  stats.metaIdsInserted = {
    nodeIds: metaToInsert.nodes.map((n) => n.id),
    relationIds: metaToInsert.relations.map((r) => r.id),
  };
  stats.nodeIdsInserted = nodesToInsert.map((n) => n.id);

  return stats;
};
