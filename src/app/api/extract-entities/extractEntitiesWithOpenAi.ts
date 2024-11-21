import { fetchFromOpenAi } from "@/app/api/utils/openai";
import { env } from "@/envBackend";

const PROMPT = `
Extract the named entities and relations between them in subsequent queries as per the following format. Specifically list the named entities, then sub-bullets showing each of their relationships after a colon.
Don't forget newlines between entries.
If you don't find any named entities or relations, return an empty string or None.

Examples:

Input: Tom Smith is a great guy who built lots of communities after he studied at Stanford and Harvard. He also won the Nobel Prize in 2020.
Output:
Tom Smith
- studied at: Stanford, Harvard
- won: Nobel Prize in 2020

Input: I am thinking about going for a walk later.
Output: None

Input: Microsoft Corporation, founded by Bill Gates and Paul Allen, developed Windows 10 and released it in 2015. Additionally, Bill Gates started the Bill and Melinda Gates Foundation.
Output:
Microsoft Corporation
- founded by: Bill Gates, Paul Allen
- developed: Windows 10
- released: Windows 10 in 2015

Bill Gates
- founded: Microsoft Corporation
- started: Bill and Melinda Gates Foundation

Paul Allen
- founded: Microsoft Corporation

Bill and Melinda Gates Foundation
- started by: Bill Gates

Input: After graduating from Columbia University, Barack Obama went on to become the President of the United States. He was born in Hawaii and is married to Michelle Obama.
Output:
Barack Obama
- graduated from: Columbia University
- became: President of the United States
- was born in: Hawaii
- married to: Michelle Obama

Michelle Obama
- married to: Barack Obama

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
  let outputText = "";
  const textChunks = textToChunks(text);

  const model = env.EXTRACT_ENTITIES_OPENAI_MODEL ? env.EXTRACT_ENTITIES_OPENAI_MODEL : "gpt-4o-mini";
  const temp = env.EXTRACT_ENTITIES_OPENAI_TEMP !== null ? env.EXTRACT_ENTITIES_OPENAI_TEMP : 0.25;

  const results = await Promise.allSettled(
    textChunks.map(async (chunk) =>
      fetchFromOpenAi(
        `https://api.openai.com/v1/chat/completions`,
        JSON.stringify({
          model: model,
          temperature: temp,
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
        }),
      ),
    ),
  );

  outputText = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result as PromiseFulfilledResult<any>) // Typescript not smart enough to realize that the filter above guarantees this
    .map((result) => result.value?.choices?.[0]?.message?.content)
    .filter((text) => !text.match(/^None.?$/) && text.length)
    .join("");

  return outputText;
};
