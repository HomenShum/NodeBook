import { Pinecone } from "@pinecone-database/pinecone";
import { eq } from "drizzle-orm";
import { OpenAI } from "openai";

import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";
import { env } from "@/envBackend";
import logger from "@/lib/logger";
import { pgConnectionStringToPineconeIndexName } from "@/lib/pinecone";

const MODEL_NAME = "gpt-4o";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type TextChip = {
  type: "text";
  content: string;
};

type CitationChip = {
  type: "citation";
  nodeId: string;
};

type LinkChip = {
  type: "link";
  url: string;
  content: string;
};

// This regex captures either double-bracket citations or Markdown links.
const MARKDOWN_PATTERN = /(\[\[(.*?)\]\])|(\[([^\]]+)\]\((.*?)\))/g;

// Define match types
type LinkMatch = {
  text: string;
  url: string;
  fullMatch: string;
};

type CitationMatch = {
  entityName: string;
  fullMatch: string;
};

type MatchPosition = {
  matchIndex: number;
  matchLength: number;
};

type Match = MatchPosition & {
  link: LinkMatch | null;
  citation: CitationMatch | null;
};

function parseMarkdownMatches(text: string): Match[] {
  const matches: Match[] = [];
  let match;

  MARKDOWN_PATTERN.lastIndex = 0; // reset lastIndex
  // match[0] is always the full match
  // match[1], match[2] are for citation: full citation, entity name
  // match[3], match[4], match[5] are for link: full link, link text, url
  while ((match = MARKDOWN_PATTERN.exec(text)) !== null) {
    matches.push({
      citation: match[1]
        ? {
            entityName: match[2].trim(),
            fullMatch: match[1],
          }
        : null,
      link: match[3]
        ? {
            text: match[4].trim(),
            url: match[5].trim(),
            fullMatch: match[3],
          }
        : null,
      matchIndex: match.index,
      matchLength: match[0].length,
    });
  }

  return matches;
}

/**
 * Convert final text into an array of chips:
 * - Citations: [[Some entity]]
 * - Links: [text](https://www.example.com)
 * - Everything else is text
 */
function parseChipsFromText(
  finalText: string,
  lookupResults: Map<string, string>,
): Array<TextChip | CitationChip | LinkChip> {
  const chips: Array<TextChip | CitationChip | LinkChip> = [];
  let currentIndex = 0;

  const matches = parseMarkdownMatches(finalText);

  for (const matchData of matches) {
    // Add text before this match as a plain text chip
    const textBeforeMatch = finalText.slice(currentIndex, matchData.matchIndex);

    if (matchData.citation) {
      // Double-bracket citation
      const { entityName } = matchData.citation;
      const nodeId = lookupResults.get(entityName) ?? entityName;

      // Create or append to text chip with bolded citation text
      const boldedText = `**${entityName}**`;
      if (textBeforeMatch || chips.length === 0) {
        chips.push({
          type: "text",
          content: textBeforeMatch + boldedText,
        });
      } else {
        // Append to the last text chip if it exists
        const lastChip = chips[chips.length - 1];
        if (lastChip.type === "text") {
          lastChip.content += boldedText;
        } else {
          chips.push({
            type: "text",
            content: boldedText,
          });
        }
      }

      // Add the citation chip
      chips.push({
        type: "citation",
        nodeId,
      });
    } else if (matchData.link) {
      // Markdown link
      if (textBeforeMatch) {
        chips.push({
          type: "text",
          content: textBeforeMatch,
        });
      }

      chips.push({
        type: "link",
        url: matchData.link.url,
        content: matchData.link.text,
      });
    }

    currentIndex = matchData.matchIndex + matchData.matchLength;
  }

  // Add any remaining text
  if (currentIndex < finalText.length) {
    chips.push({
      type: "text",
      content: finalText.slice(currentIndex),
    });
  }

  return chips;
}

const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const indexName = pgConnectionStringToPineconeIndexName(env.POSTGRES_CONNECTION_STRING);

const MAX_QUERIES = 5;

async function queryIndex(query: string, topK: number = 3, userId: string | undefined = undefined) {
  const response = await pinecone.inference.embed("multilingual-e5-large", [query], {
    inputType: "query",
  });
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
    // First try exact match in the DB
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
      const bestMatch = matches[0];
      results.set(entity, bestMatch.id);
    }
  }

  return results;
}

/**
 * Once we've decided that the LLM's last message is the final,
 * we parse out any entity names in [[...]], look them up,
 * then parse to chips.
 */
async function handleFinalStep(finalAnswer: string, userId: string | undefined): Promise<string> {
  // 1) Find all unique entities in [[some entity]] form
  const citationsRegex = /\[\[(.*?)\]\]/g;
  const citedEntities = new Set<string>();
  let match;
  while ((match = citationsRegex.exec(finalAnswer)) !== null) {
    const entityName = match[1].trim();
    citedEntities.add(entityName);
  }

  // 2) Lookup those entities to get their node IDs
  const lookupResults = await lookupEntities(Array.from(citedEntities), userId);

  // 3) Convert the final text into chips
  const chips = parseChipsFromText(finalAnswer, lookupResults);

  // 4) Return as JSON
  return JSON.stringify({ content: [chips] }, null, 2);
}

/**
 * New system prompt:
 * - LLM can request more queries via "ADDITIONAL_QUERY_<k>: <query>"
 * - Otherwise, it should produce its final textual answer.
 * - For knowledge graph references, it should use [[Entity Name]] style.
 * - For web URLs, it should use standard Markdown link syntax.
 */
const SYSTEM_PROMPT = `You are a senior analyst specialized in answering complex user-generated queries in a variety of domains, 
using an advanced knowledge graph system called Mew. For any given query, you will also be provided with a set of nodes retrieved 
from Mew using the user's query. The nodes will be delimited by XML tags and presented to you with their 
immediate context. For example, consider that for the user query "Stanford Professors Calvin Xu has worked with",
the node "Calvin Xu" is retrieved from Mew. It will be presented to you as follows, where under RELATIONSHIPS, all entities related
to the node are listed with their relationship to the node; "child" and "parent" indicate hierarchy and are the most common relationships.

<node_context>
CONTENT: Calvin Xu
RELATIONSHIPS:
- member: Syrgkanis Lab
- liked by: CS205L Continuous Mathematical Methods for Machine Learning
</node_context>

If you need more information about related entities to answer the query, you may request up to ${MAX_QUERIES} additional queries,
each retrieving up to k nodes from Mew. To do so, respond with: ADDITIONAL_QUERY_<k>: <your query>. In this example, \`ADDITIONAL_QUERY_3: "Syrgkanis Lab"\` will retrieve up to 3 related nodes:

<node_context>
CONTENT: Syrgkanis Lab
RELATIONSHIPS:
- member: Calvin Xu
- child: Vasilis Syrgkanis
</node_context>

When you have sufficient information, respond with your final answer in normal text:
- Any specific entities / nodes in the knowledge graph must be cited using double-square brackets.
  - for example, "[[Calvin Xu]] has worked with [[Vasilis Syrgkanis]]"
  - never quote a node by name, always use double-square brackets
- Use standard Markdown for web links, e.g. [link text](https://example.com).
  - never quote a link, always use the Markdown link syntax
- Everything else should be plain text.
- Be succinct and to the point.
- If it is unclear whether your answer satisfies all constraints of the user's query, clearly state that.
- Do not use first person in your answer. Do not mention your thinking process or how you arrived at your answer.
`;

/**
 * Main ask function
 */
export async function ask(query: string, debug: boolean = false, userId: undefined | string): Promise<string> {
  if (debug) {
    logger.debug("\n" + "=".repeat(50));
    logger.debug(`INITIAL QUERY: ${query}`);
    logger.debug("=".repeat(50));
  }

  const matches = await queryIndex(query, 3, userId);

  const context = await Promise.all(
    matches.map(async (match) => {
      const text = match.metadata?.text;
      return text ? `<node_context>\n${text}\n</node_context>\n\n` : "";
    }),
  );

  if (debug) {
    logger.debug("\nINITIAL CONTEXT:");
    logger.debug("-".repeat(50));
    logger.debug(context.join(""));
    logger.debug("-".repeat(50));
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
      logger.debug(`\nTURN ${queriesMade + 1}`);
      logger.debug("-".repeat(50));
    }

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0,
    });

    const assistantResponse = response.choices[0].message.content ?? "";

    if (debug) {
      logger.debug("\nASSISTANT:");
      logger.debug(assistantResponse);
    }

    if (assistantResponse.includes("ADDITIONAL_QUERY_")) {
      queriesMade++;
      // "ADDITIONAL_QUERY_<k>: <some text>"
      const queryPart = assistantResponse.split("ADDITIONAL_QUERY_")[1].split("\n")[0].trim();
      const k = parseInt(queryPart.split(":")[0]);
      const newQuery = queryPart.split(":", 2)[1].trim();

      if (debug) {
        logger.debug(`\nMAKING ADDITIONAL QUERY (k=${k}):`);
        logger.debug(newQuery);
      }

      // Retrieve context for the new query
      const newMatches = await queryIndex(newQuery, k, userId);
      const newContext = await Promise.all(
        newMatches.map(async (match) => {
          const text = match.metadata?.text;
          return text ? `<node_context>\n${text}\n</node_context>\n\n` : "";
        }),
      );

      if (debug) {
        logger.debug("\nADDITIONAL CONTEXT:");
        logger.debug("-".repeat(50));
        logger.debug(newContext.join(""));
        logger.debug("-".repeat(50));
      }

      // Add assistant's last response & new context
      messages.push({ role: "assistant", content: assistantResponse });
      messages.push({
        role: "user",
        content: `Additional context for query '${newQuery}':\n${newContext.join(
          "",
        )}\n\n If you are ready to compose the final answer, remember to cite all entities using double-square brackets.`,
      });
    } else {
      // We treat whatever the model returned as final if it does not request more queries
      messages.push({ role: "assistant", content: assistantResponse });
      if (debug) {
        logger.debug("\nNo more additional queries requested. Using final answer from LLM.\n");
      }
      return handleFinalStep(assistantResponse, userId);
    }
  }

  if (debug) {
    logger.debug("\nMAX QUERIES REACHED - FORCING FINAL ANSWER");
  }

  messages.push({
    role: "user",
    content: `You have used all available additional queries. Please provide your final answer addressing the original query "${query}" now, citing nodes with [[Entity Name]] and standard Markdown for web links.`,
  });

  const finalResponse = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages,
    temperature: 0,
  });

  const forcedAnswer = finalResponse.choices[0].message.content ?? "";
  messages.push({ role: "assistant", content: forcedAnswer });
  return handleFinalStep(forcedAnswer, userId);
}
