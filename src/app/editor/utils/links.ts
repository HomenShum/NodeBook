import { LexicalNode, TextNode } from "lexical";

import { nodeToChip } from "@/app/editor/utils/content";
import { Chip } from "@/app/graph/GraphNode";
import { $createLinkNode } from "@/app/graph/LinkNode";

export type Match = {
  index: number;
  length: number;
  url: string;
  text: string;
};

const COMMON_TLDS = [
  "com",
  "org",
  "gov",
  "edu",
  "network",
  "net",
  "info",
  "ca",
  "uk",
  "de",
  "rs",
  "ru",
  "ir",
  "me",
  "io",
  "app",
  "biz",
  "dev",
  "xyz",
  "asia",
].join("|");

// High confidence links start with the http:// or https:// schemas. We allow any TLD for the high confidence links
// ([a-z0-9\-]+\.)+ matches subdomains and domain
// ([a-z0-9]{2,24}) matches TLD
const HIGH_CONFIDENCE_URL_REGEX = `https?:\\/\\/((([a-z0-9-]+\\.)+([a-z0-9-]{2,24}))|localhost)`;

// Low confidence links (without the schema) are likely typed by the user directly. We only allow the most popular TLDs.
// Otherwise similar to highConfidenceLink.
const LOW_CONFIDENCE_URL_REGEX = `((([a-z0-9-]+\\.)+(?:${COMMON_TLDS}))|localhost)`;

// (:[0-9]+) optional port number
// ([?/](([^\s])*([^.\s,])+)?)? optional path matching after tld/port.
//    - [?/] Must start with a slash or question mark
//    - (([^\s])*([^\.\s,])+)? - Anything after slash is optional, but if not
//                              match all non whitespace characters, do not end
//                              with period or dot or whitespace
const END = `(:[0-9]+)?([?/](([^\\s])*([^.\\s,])+)?)?`;

const URL_REGEX = new RegExp(`(${HIGH_CONFIDENCE_URL_REGEX + END})|(${LOW_CONFIDENCE_URL_REGEX + END})`, "giu");

/** Find all the URL matches in the text */
export const findUrlMatches = (text: string): Match[] => {
  const matches = [];
  let currentMatch = URL_REGEX.exec(text);

  while (currentMatch) {
    const fullMatch = currentMatch[0];
    const isPartOfEmail =
      !fullMatch.startsWith("http") &&
      !!text.slice(Math.max(0, currentMatch.index - 2), currentMatch.index).match(/\S@/);
    if (!isPartOfEmail) {
      matches.push({
        index: currentMatch.index,
        length: fullMatch.length,
        url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
        text: fullMatch,
      });
    }
    currentMatch = URL_REGEX.exec(text);
  }

  return matches;
};

/** Convert matches to new Lexical nodes */
export const matchesToNodes = (text: string, matches: Match[]): LexicalNode[] => {
  if (!matches.length) return [];

  let currentOffset = 0;
  const nodes = matches.reduce((acc, match) => {
    if (match.index > currentOffset) {
      acc.push(new TextNode(text.slice(currentOffset, match.index)));
    }

    const url = match.text;
    const linkNode = $createLinkNode(url.startsWith("http") ? url : `https://${url}`, url);
    acc.push(linkNode);

    currentOffset = match.index + match.length;
    return acc;
  }, [] as LexicalNode[]);

  if (currentOffset < text.length) {
    nodes.push(new TextNode(text.slice(currentOffset)));
  }

  return nodes;
};

export function transformTextToChips(text: string): Chip[] {
  const matches = findUrlMatches(text);
  const nodes = matchesToNodes(text, matches);
  if (nodes.length === 0) {
    return [{ type: "text", value: text }];
  } else {
    return nodes.map(nodeToChip);
  }
}
