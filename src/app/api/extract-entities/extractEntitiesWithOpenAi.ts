import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import {
  ExtractedEntity,
  ExtractEntitiesOpenAiResponse,
  ExtractEntitiesOpenAiSchema,
} from "@/app/api/extract-entities/ExtractEntitiesOpenAiResponse";
import { env } from "@/envBackend";

const PROMPT = `
Extract the named entities and relations between them.

Examples:

Input: Tom Smith is a great guy who built lots of communities after he studied at Stanford and Harvard. He also won the Nobel Prize in 2020.
Output:
[
  {
    name: "Tom Smith",
    relations: [
      { relation: "studied at", otherEntities: ["Stanford", "Harvard"] },
      { relation: "won", otherEntities: ["Nobel Prize"] },
    ]
  }
]

Input: I am thinking about going for a walk later.
Output: None

Input: Microsoft Corporation, founded by Bill Gates and Paul Allen, developed Windows 10 and released it in 2015. Additionally, Bill Gates started the Bill and Melinda Gates Foundation.
Output:
[
  {
    name: "Microsoft Corporation",
    relations: [
      { relation: "founded by", otherEntities: ["Bill Gates", "Paul Allen"] },
      { relation: "developed", otherEntities: ["Windows 10"] },
    ]
  },
  {
    name: "Bill Gates",
    relations: [
      { relation: "founded", otherEntities: ["Microsoft Corporation"] },
      { relation: "started", otherEntities: ["Bill and Melinda Gates Foundation"] },
    ]
  },
  {
    name: "Paul Allen",
    relations: [
      { relation: "founded", otherEntities: ["Microsoft Corporation"] },
    ]
  },
  {
    name: "Bill and Melinda Gates Foundation",
    relations: [
      { relation: "started by", otherEntities: ["Bill Gates"] },
    ]
  }
]

Input: After graduating from Columbia University, Barack Obama went on to become the President of the United States. He was born in Hawaii and is married to Michelle Obama.
Output:
[
  {
    name: "Barack Obama",
    relations: [
      { relation: "graduated from", otherEntities: ["Columbia University"] },
      { relation: "was", otherEntities: ["President of the United States"] },
      { relation: "born in", otherEntities: ["Hawaii"] },
      { relation: "married to", otherEntities: ["Michelle Obama"] },
    ]
  },
  {
    name: "Michelle Obama",
    relations: [
      { relation: "married to", otherEntities: ["Barack Obama"] },
    ]
  }
]

Input: The weather is surprisingly pleasant today, considering it's usually quite hot around this time of the year.
Output: None
`;

// Function to split text into chunks of 4000 characters or less, well within OpenAI's limits
const textToChunks = (input: string) => {
  const chunks = [];
  let curChunk = "";
  const sentences = input.split(/\.\s/);
  for (let sentence of sentences) {
    sentence += ". "; // Add back the period and space that was removed by the split
    if (curChunk.length + sentence.length > 4000) {
      chunks.push(curChunk);
      curChunk = "";
    }
    curChunk += sentence;
  }
  if (curChunk.length) {
    chunks.push(curChunk);
  }
  return chunks;
};

export const extractEntitiesWithOpenAi = async (text: string) => {
  const textChunks = textToChunks(text);

  const model = env.EXTRACT_ENTITIES_OPENAI_MODEL ? env.EXTRACT_ENTITIES_OPENAI_MODEL : "gpt-4o-mini";
  const temp = env.EXTRACT_ENTITIES_OPENAI_TEMP !== null ? env.EXTRACT_ENTITIES_OPENAI_TEMP : 0.25;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const results = await Promise.allSettled(
    textChunks.map(
      async (chunk) =>
        await openai.beta.chat.completions.parse({
          model: model,
          messages: [
            {
              role: "system",
              content: PROMPT,
            },
            {
              role: "user",
              content: chunk,
            },
          ],
          temperature: temp,
          response_format: zodResponseFormat(ExtractEntitiesOpenAiSchema, "extracted_entities"),
        }),
    ),
  );

  const output: ExtractedEntity[] = results
    .filter((result) => result.status === "fulfilled")
    .filter((result) => result.value.choices[0].message.refusal === null)
    .map((result) => result.value.choices[0].message.parsed as ExtractEntitiesOpenAiResponse)
    .reduce((acc: ExtractedEntity[], val) => acc.concat(val.entities), []);

  return output;
};
