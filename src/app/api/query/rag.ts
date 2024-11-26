import console from "console";

import { Pinecone } from "@pinecone-database/pinecone";
import { eq } from "drizzle-orm";
import { OpenAI } from "openai";

import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";
import { env } from "@/envBackend";
import { pgConnectionStringToPineconeIndexName } from "@/lib/pinecone";

const MAX_QUERIES = 5;

// Initialize clients once per module load
const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const indexName = pgConnectionStringToPineconeIndexName(env.POSTGRES_CONNECTION_STRING);

// Types
type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Core functions
async function queryIndex(query: string, topK: number = 3, userId: string | undefined = undefined) {
  const response = await pinecone.inference.embed("multilingual-e5-large", [query], { inputType: "query" });
  const vector = response.data[0].values;
  if (!vector) {
    return [];
  }
  const index = pinecone.Index(indexName);
  const publicResults = await index.namespace("public").query({ vector, topK, includeMetadata: true });
  const matches = publicResults.matches;
  if (userId !== undefined) {
    const privateResults = await index.namespace(userId).query({ vector, topK, includeMetadata: true });
    matches.push(...privateResults.matches);
  }
  // sort by score and return topK
  matches.sort((a, b) => {
    if (a.score === undefined) {
      return b.score === undefined ? 0 : 1;
    }
    if (b.score === undefined) {
      return -1;
    }
    return b.score - a.score;
  });
  return matches.slice(0, topK);
}

async function lookupEntities(entities: string[], userId: string | undefined): Promise<Map<string, string>> {
  const db = getDb();
  const results = new Map<string, string>();

  for (const entity of entities) {
    // First try exact match
    const nodes = await db
      .select({ id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(eq(graphNodeTable.content, JSON.stringify([{ type: "text", value: entity }])))
      .limit(1);

    if (nodes.length > 0) {
      results.set(entity, nodes[0].id);
      continue;
    }

    // Fall back to embedding search
    const matches = await queryIndex(entity, 1, userId);
    if (matches.length > 0) {
      results.set(entity, matches[0].id);
    }
  }

  return results;
}

async function handleFinalStep(
  originalQuery: string,
  messages: Message[],
  debug: boolean,
  userId: string | undefined,
): Promise<string> {
  const assistantResponse = messages[messages.length - 1].content;

  if (!assistantResponse?.includes("FINAL_READY") || !assistantResponse?.includes("ENTITY_LOOKUPS:")) {
    throw new Error("Invalid response format - missing FINAL_READY or ENTITY_LOOKUPS");
  }

  const lookupPart = assistantResponse.split("ENTITY_LOOKUPS:")[1].trim();
  const entities = lookupPart
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.slice(1).trim());

  const lookupResults = await lookupEntities(entities, userId);
  const lookupResultsText = Array.from(lookupResults.entries())
    .map(([entity, nodeId]) => `${entity}: ${nodeId}`)
    .join("\n");

  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      ...messages,
      { role: "assistant", content: assistantResponse },
      {
        role: "user",
        content: `Here are the node IDs for your entity lookups:\n\n${lookupResultsText}\n\nPlease compose your final answer addressing the original query: "${originalQuery}".\nStart your response with "FINAL_ANSWER" and cite each entity using double brackets [[node_id]]. When citing, include the text of the entity and put the citation next to it.`,
      },
    ],
    temperature: 0,
  });

  const finalResponseContent = finalResponse.choices[0].message.content;

  if (!finalResponseContent?.startsWith("FINAL_ANSWER")) {
    throw new Error("Invalid response format - missing FINAL_ANSWER prefix");
  }

  return finalResponseContent.replace("FINAL_ANSWER:", "").replace("FINAL_ANSWER", "").trim();
}

const SYSTEM_PROMPT = `You are an senior analyst specialized in answering complex user-generated queries in a variety of domains, 
using an advanced knowledge graph system called Mew. For any given query, you will be provided with a set of nodes retrieved 
from Mew using the user's query. The nodes will be delimited by XML tags and presented to you with their 
2-hop context. For example, consider that for the user query "Stanford Professors Calvin Xu has worked with",
the node "Calvin Xu" is retrieved from Mew. It will be presented to you as follows:

<node_context>
CONTENT: Calvin Xu
RELATIONSHIPS:
- member: Syrgkanis Lab (id: lab123)
- works with: Charilaos Kanatsoulis (id: char456)
- liked by: CS205L Continuous Mathematical Methods for Machine Learning (id: cs205)
</node_context>

If you need more information to answer the question completely, you can request up to ${MAX_QUERIES}
additional queries each retrieving k nodes from Mew that will be presented to you in the same way.
To do so, respond with the word "ADDITIONAL_QUERY_<k>: <your query>".

When you have sufficient information to answer the original query, respond in the following format:
FINAL_READY
ENTITY_LOOKUPS:
- entity_1
- entity_2
...`;

/**
 * Ask Mew a question
 */
export async function ask(query: string, debug: boolean = false, userId: undefined | string): Promise<string> {
  if (debug) {
    console.log("\n" + "=".repeat(50));
    console.log(`INITIAL QUERY: ${query}`);
    console.log("=".repeat(50));
  }

  // Initial query
  const matches = await queryIndex(query, 3, userId);

  // Get textual representations
  const context = await Promise.all(
    matches.map(async (match) => {
      let text = match.metadata?.text;
      return text ? `<node_context>\n${text}\n</node_context>\n\n` : "";
    }),
  );

  if (debug) {
    console.log("\nINITIAL CONTEXT:");
    console.log("-".repeat(50));
    console.log(context.join(""));
    console.log("-".repeat(50));
  }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Query: ${query}\n\nRelevant nodes for context:\n${context.join(
        "",
      )}\n\nYou can request up to ${MAX_QUERIES} additional queries each retrieving k nodes by responding with "ADDITIONAL_QUERY_<k>: <your query>".`,
    },
  ];

  let queriesMade = 0;
  while (queriesMade < MAX_QUERIES) {
    if (debug) {
      console.log(`\nTURN ${queriesMade + 1}`);
      console.log("-".repeat(50));
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0,
    });

    const assistantResponse = response.choices[0].message.content;

    if (debug) {
      console.log("\nASSISTANT:");
      console.log(assistantResponse);
    }

    if (assistantResponse?.includes("ADDITIONAL_QUERY_")) {
      queriesMade++;

      const queryPart = assistantResponse.split("ADDITIONAL_QUERY_")[1].split("\n")[0].trim();
      const k = parseInt(queryPart.split(":")[0]);
      const newQuery = queryPart.split(":", 2)[1].trim();

      if (debug) {
        console.log(`\nMAKING ADDITIONAL QUERY (k=${k}):`);
        console.log(newQuery);
      }

      const newMatches = await queryIndex(newQuery, k, userId);
      const newContext = await Promise.all(
        newMatches.map(async (match) => {
          const text = match.metadata?.text;
          return text ? `<node_context>\n${text}\n</node_context>\n\n` : "";
        }),
      );

      if (debug) {
        console.log("\nADDITIONAL CONTEXT:");
        console.log("-".repeat(50));
        console.log(newContext.join(""));
        console.log("-".repeat(50));
      }

      messages.push({ role: "assistant", content: assistantResponse });
      messages.push({
        role: "user",
        content: `Additional context for query '${newQuery}':\n${newContext.join("")}`,
      });
    } else if (assistantResponse?.includes("FINAL_READY")) {
      messages.push({ role: "assistant", content: assistantResponse });
      return handleFinalStep(query, messages, debug, userId);
    } else {
      messages.push({ role: "assistant", content: assistantResponse || "" });
      break;
    }
  }

  // Max queries reached
  if (debug) {
    console.log("\nMAX QUERIES REACHED OR INVALID RESPONSE FORMAT - FORCING FINAL ANSWER");
  }

  messages.push({
    role: "user",
    content: `You have used all available additional queries or the response format was invalid. Please provide your FINAL_READY and entity lookups based on the information you have.`,
  });

  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0,
  });

  messages.push({ role: "assistant", content: finalResponse.choices[0].message.content || "" });
  return handleFinalStep(query, messages, debug, userId);
}
