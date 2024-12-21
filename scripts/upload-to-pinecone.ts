/**
 * This script uploads node content and relationship data to Pinecone for semantic search.
 *
 * It:
 * 1. Builds a graph from the database including nodes and their relationships
 * 2. Generates text representations of each node and its neighbors
 * 3. Creates embeddings using the multilingual-e5-large model
 * 4. Uploads the embeddings and metadata to Pinecone in batches
 *
 * The text representation format for each node is:
 * CONTENT: <node content>
 * RELATIONSHIPS:
 * - <relation label>: <neighbor content> (id: <neighbor id>)
 *
 * This allows semantic search to consider both node content and relationships.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  graphNodeTable,
  graphRelationTable,
  PersistedGraphNode,
  PersistedRelationType,
  relationTypeTable,
} from "@/db/schema";
import { MewDatabase } from "@/db/types";
import { env } from "@/envBackend";
import { pgConnectionStringToPineconeIndexName } from "@/lib/pinecone";

const indexName = pgConnectionStringToPineconeIndexName(env.POSTGRES_CONNECTION_STRING);
console.log("Index name:", indexName);
type PineconeIndex = ReturnType<Pinecone["Index"]>;

interface Graph {
  nodes: Map<string, PersistedGraphNode>;
  relations: Map<string, Relation>;
  texts: Map<string, string>;
  relationIdsByNodeId: Map<string, Set<string>>;
}

interface Relation {
  id: string;
  fromId: string;
  toId: string;
  relationLabel: string;
  reverseLabel: string;
}

async function hasRecentChanges(db: MewDatabase, hours: number = 24): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(graphNodeTable)
    .where(sql`updated_at > NOW() - INTERVAL '${hours} hours'`);

  return result[0].count > 0;
}

async function getOrCreateIndex(pc: Pinecone): Promise<PineconeIndex> {
  const indexList = await pc.listIndexes();
  const hasIndex = indexList.indexes?.find((i) => i.name === indexName);
  if (!hasIndex) {
    await pc.createIndex({
      name: indexName,
      dimension: 1024,
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-west-2",
        },
      },
    });
  }
  return pc.Index(indexName);
}

async function buildGraph(db: MewDatabase): Promise<Graph> {
  const nodes = await db.select().from(graphNodeTable);
  const relations = await db.select().from(graphRelationTable);
  const relationTypes = await db.select().from(relationTypeTable);

  const graph: Graph = {
    nodes: new Map(),
    relations: new Map(),
    relationIdsByNodeId: new Map(),
    texts: new Map(),
  };

  // Add nodes
  nodes.forEach((node) => {
    graph.nodes.set(node.id, node);
  });
  nodes.forEach((node) => {
    graph.texts.set(node.id, getNodeText(node.id, graph));
  });

  // Add edges
  const relationTypesById = new Map<string, PersistedRelationType>();
  relationTypes.forEach((rt) => {
    relationTypesById.set(rt.id, rt);
  });
  relations.forEach((relation) => {
    if (!relation.fromId || !relation.toId) return;

    const relationType = relationTypesById.get(relation.relationTypeId!);
    let relationLabel: string;
    let reverseLabel: string;
    if (relationType) {
      relationLabel = relationType.label!;
      reverseLabel = relationType.reverseLabel!;
    } else {
      // TODO weird we need this but the lippdemo was missing the child/parent relation types
      relationLabel = "child";
      reverseLabel = "parent";
    }

    const edge: Relation = {
      id: relation.id,
      fromId: relation.fromId,
      toId: relation.toId,
      relationLabel,
      reverseLabel,
    };

    graph.relations.set(relation.id, edge);

    if (!graph.relationIdsByNodeId.has(relation.fromId)) {
      graph.relationIdsByNodeId.set(relation.fromId, new Set());
    }
    graph.relationIdsByNodeId.get(relation.fromId)!.add(relation.id);

    if (!graph.relationIdsByNodeId.has(relation.toId)) {
      graph.relationIdsByNodeId.set(relation.toId, new Set());
    }
    graph.relationIdsByNodeId.get(relation.toId)!.add(relation.id);
  });

  return graph;
}

/**
 * Returns the text of a node, including the text of any mentioned nodes
 * up to a depth of 2.
 */
function getNodeText(nodeId: string, graph: Graph, depth = 0): string {
  if (graph.texts.has(nodeId)) return graph.texts.get(nodeId)!;
  if (depth > 2) return "";
  let result = "";
  try {
    const contentArray = JSON.parse(graph.nodes.get(nodeId)?.content || "");
    for (const item of contentArray) {
      if (item.type === "mention") {
        const mentionId = item.value;
        result += getNodeText(mentionId, graph, depth + 1);
      } else {
        result += item.value;
      }
    }
  } catch {}
  graph.texts.set(nodeId, result);
  return result;
}

/**
 * Returns a string representation of the node and its neighbors.
 *
 * The format is:
 * CONTENT: <node content>
 * RELATIONSHIPS:
 * - <relation label>: <neighbor content> (id: <neighbor id>)
 * - ...
 *
 */
function getNodeAndNeighboursText(graph: Graph, nodeId: string): string | null {
  if (!graph.nodes.has(nodeId)) return null;
  const nodeContent = getNodeText(nodeId, graph);
  const edgeIds = graph.relationIdsByNodeId.get(nodeId);
  const edges = Array.from(edgeIds || [])
    .map((id) => graph.relations.get(id))
    .filter((e) => e) as Relation[];
  const neighbors: { label: string; text: string; id: string }[] = [];
  for (const edge of edges) {
    if (edge.fromId === nodeId) {
      neighbors.push({ label: edge.relationLabel, text: getNodeText(edge.toId, graph), id: edge.toId });
    } else {
      neighbors.push({ label: edge.reverseLabel, text: getNodeText(edge.fromId, graph), id: edge.fromId });
    }
  }
  let result = `CONTENT: ${nodeContent}`;
  if (neighbors.length > 0) {
    result += "\nRELATIONSHIPS:\n";
    for (const neighbor of neighbors) {
      result += `- ${neighbor.label}: ${neighbor.text} (id: ${neighbor.id})\n`;
    }
  }
  return result;
}

function trimText(text: string, maxTokens = 8191): string {
  // Note: This is a simplified version. For proper token counting,
  // you might want to use a tokenizer library like GPT-Tokenizer
  // or implement a more sophisticated counting method
  const approxCharsPerToken = 4;
  const maxChars = maxTokens * approxCharsPerToken;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

async function main(options: { sinceHours?: number }) {
  const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  const index = await getOrCreateIndex(pinecone);
  const db = getDb();

  // Check for recent changes if sinceHours is specified
  if (options.sinceHours) {
    const hasChanges = await hasRecentChanges(db, options.sinceHours);
    if (!hasChanges) {
      console.log(`No changes in the last ${options.sinceHours} hours. Skipping update.`);
      return;
    }
  }

  console.log("Building graph from database...");
  const graph = await buildGraph(db);

  console.log("Generating text representations...");
  const nodesWithText: Array<{ node_id: string; text: string; namespace: string }> = [];
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (!node.content) continue;
    const text = getNodeAndNeighboursText(graph, nodeId);
    if (text) {
      nodesWithText.push({
        node_id: nodeId,
        text: trimText(text),
        namespace: node.isPublic ? "public" : node.authorId,
      });
    }
  }

  console.log("Generating embeddings and upserting to Pinecone...");
  const batchSize = 96; // embeddings can be most generated in batches of 96
  const maxConcurrent = 10;

  // Partition into different namespaces
  const namespaces = new Set(nodesWithText.map((n) => n.namespace));
  for (const namespace of namespaces) {
    const subsetNodes = nodesWithText.filter((n) => n.namespace === namespace);
    console.log("Processing namespace:", namespace);

    for (let i = 0; i < subsetNodes.length; i += batchSize * maxConcurrent) {
      const batchPromises = [];
      // Create up to maxConcurrent batch promises
      for (let j = 0; j < maxConcurrent && i + j * batchSize < subsetNodes.length; j++) {
        const start = i + j * batchSize;
        const batch = subsetNodes.slice(start, start + batchSize);

        const batchPromise = (async () => {
          // Generate embeddings for batch
          const response = await pinecone.inference.embed(
            "multilingual-e5-large",
            batch.map((t) => t.text),
            {
              inputType: "passage",
              truncate: "END",
            },
          );
          const embeddings = response.data.map((item) => item.values).filter((v): v is number[] => v !== undefined);

          // Prepare and upsert vectors
          const vectors = batch.map((item, idx) => ({
            id: item.node_id,
            values: embeddings[idx],
            metadata: {
              text: item.text,
            },
          }));
          await index.namespace(namespace).upsert(vectors);

          console.log(
            `Processed batch ${Math.floor(start / batchSize) + 1} of ${Math.ceil(subsetNodes.length / batchSize)}`,
          );
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all concurrent batches to complete before starting the next group
      await Promise.all(batchPromises);
    }
  }

  console.log("Done! Your Pinecone index has been populated.");
}

if (require.main === module) {
  const args = process.argv.slice(2);

  let sinceHours: number | undefined = undefined;
  const sinceHoursIndex = args.indexOf("--since-hours");
  if (sinceHoursIndex !== -1 && args[sinceHoursIndex + 1]) {
    sinceHours = parseInt(args[sinceHoursIndex + 1], 10);
  }

  main({ sinceHours }).catch(console.error);
}
