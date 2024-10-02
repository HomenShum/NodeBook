import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";

import { $getChips } from "@/app/editor/utils";
import { Chip } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import logger from "@/lib/logger";

type Match = {
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
  "network",
].join("|");

// High confidence links start with the http:// or https:// schemas. We allow any TLD for the high confidence links
// ([a-z0-9\p{Emoji}-]+\.)+ matches subdomains and domain
// ([a-z0-9]{2,24}) matches TLD
const HIGH_CONFIDENCE_URL_REGEX = `https?:\\/\\/((([a-z0-9\\p{Emoji}-]+\\.)+([a-z0-9-]{2,24}))|localhost)`;
// Low confidence links (without the schema) are likely typed by the user directly. We only allow the most popular TLDs.
// Otherwise similar to highConfidenceLink.
const LOW_CONFIDENCE_URL_REGEX = `((([a-z0-9\\p{Emoji}-]+\\.)+(${COMMON_TLDS}))|localhost)`;
// (:[\p{N}]+) optional port number
// ([?/](([^\s])*([^.\s,])+)?)? optional path matching after tld/port.
//    - [?/] Must start with a slash or question mark
//    - (([^\s])*([^.\s,])+)? - Anything after slash is optional, but if not
//                              match all non whitespace characters, do not end
//                              with period or dot or whitespace
const END = `(:[\\p{N}]+)?([?/](([^\\s])*([^.\\s,])+)?)?`;

const URL_REGEX = new RegExp(`(^|\\b)(${HIGH_CONFIDENCE_URL_REGEX + END})|(${LOW_CONFIDENCE_URL_REGEX + END})`, "giu");

/** Find all the URL matches in the text */
const findMatches = (text: string): Match[] => {
  const matches = [];
  let currentMatch = URL_REGEX.exec(text);

  while (currentMatch) {
    const fullMatch = currentMatch[0];
    matches.push({
      index: currentMatch.index,
      length: fullMatch.length,
      url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
      text: fullMatch,
    });

    currentMatch = URL_REGEX.exec(text);
  }

  return matches;
};

/** Generate the "link" and "text" chips */
const generateLinkAndTextChips = (text: string, matches: Match[]): Chip[] => {
  const chips: Chip[] = [];
  let currentStart = 0;

  matches.forEach((match, index) => {
    // Add the text before the match if there is any
    if (currentStart < match.index) {
      chips.push({ type: "text", value: text.slice(currentStart, match.index) });
    }

    // Add the link chip for the current match
    chips.push({ type: "link", url: match.url, value: match.text });

    // Add the text after the match if it's the last match and there is text
    if (index === matches.length - 1 && match.index + match.length < text.length) {
      chips.push({ type: "text", value: text.slice(match.index + match.length) });
    }

    currentStart = match.index + match.length;
  });

  return chips;
};

export const LinkPlugin = ({ nodeId }: { nodeId: string }) => {
  const graphStore = useGraphStore();

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        editorState.read(async () => {
          const chips = $getChips();
          let currentString = "";
          let hasChanged = false;

          const newChips = chips.reduce((acc: Chip[], chip, index) => {
            const isTextOrLink = chip.type === "text" || chip.type === "link";

            // Concat all consecutive text & link chips' values
            if (isTextOrLink) {
              currentString += chip.value;
            }

            // Once hit a different chip type or the last chip, parse for URLs
            if (!isTextOrLink || index === chips.length - 1) {
              if (currentString) {
                const matches = findMatches(currentString);
                if (matches.length) {
                  // If there are matches, generate the link and text chips
                  const chips = generateLinkAndTextChips(currentString, matches);
                  acc.push(...chips);
                  hasChanged = true;
                } else {
                  // Otherwise, add the current string as a text chip
                  acc.push({ type: "text", value: currentString });
                  if (chip.value !== currentString) {
                    // Normally, this shouldn't happen (adjacent text chips should be merged)
                    logger.warn("LinkPlugin: Consecutive text chips were separate for some reason");
                    hasChanged = true;
                  }
                }
                currentString = "";
              }

              if (!isTextOrLink) {
                // Don't forget to add the current chip
                acc.push(chip);
              }
            }

            return acc;
          }, []);

          if (hasChanged) {
            await graphStore.updateNode({ nodeId, nodeProps: { content: newChips } });
          }
        });
      }}
    />
  );
};
