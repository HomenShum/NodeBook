import { Inflectors } from "en-inflectors";
import posTagger from "wink-pos-tagger";

const tagger = new posTagger();

const singleAuxiliaries = new Set([
  "will",
  "would",
  "may",
  "might",
  "can",
  "could",
  "shall",
  "should",
  "must",
  "ought",
  "be",
  "am",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
]);

const perfectModalPhrases = new Set([
  "could have",
  "should have",
  "would have",
  "might have",
  "must have",
  "may have",
  "will have",
  "shall have",
  "could've",
  "should've",
  "would've",
  "might've",
  "must've",
  "may've",
  "will've",
  "shall've",
]);

function isAuxiliaryWord(word: string): boolean {
  return singleAuxiliaries.has(word.toLowerCase());
}

function toPastParticiple(word: string): string {
  if (word.toLowerCase().endsWith("ed")) return word;
  return new Inflectors(word.toLowerCase()).toPastParticiple();
}

function handleMoreLess(tokens: any[]): string | null {
  if (tokens.length < 3) return null;

  const firstWord = tokens[0].value.toLowerCase();
  const lastWord = tokens[tokens.length - 1].value.toLowerCase();

  if (lastWord !== "than") return null;

  if (firstWord === "more") {
    const middle = tokens
      .slice(1, -1)
      .map((t) => t.value)
      .join(" ");
    return `less ${middle} than`;
  }

  if (firstWord === "less") {
    const middle = tokens
      .slice(1, -1)
      .map((t) => t.value)
      .join(" ");
    return `more ${middle} than`;
  }

  return null;
}

export function guessInverse(relation: string): string {
  // Initial tokenization
  const tokens = relation
    .trim()
    .split(" ")
    .map((word) => ({ value: word }));
  if (tokens.length === 0) return "";

  // check for passive voice construction
  const lastToken = tokens[tokens.length - 1]?.value.toLowerCase();
  if (lastToken === "by") {
    const beenIndex = tokens.findIndex((t) => t.value.toLowerCase() === "been");
    if (beenIndex !== -1) {
      // Remove 'been' and 'by' to convert to active voice
      tokens.splice(beenIndex, 1); // remove 'been'
      tokens.pop(); // remove 'by'
      return tokens.map((t) => t.value).join(" ");
    }
  }

  // Handle prefixes by removing tokens
  if (tokens[0].value.toLowerCase() === "is") {
    tokens.shift();
  } else if (tokens[0].value.toLowerCase() === "has" && tokens[1]?.value.toLowerCase() === "been") {
    tokens.splice(0, 2);
  } else if (tokens[0].value.toLowerCase() === "have" && tokens[1]?.value.toLowerCase() === "been") {
    tokens.splice(0, 2);
  }

  // Handle suffixes
  if (lastToken === "of" || lastToken === "by") {
    tokens.pop();
    return tokens.map((t) => t.value).join(" ");
  }

  // POS tagging
  const taggedTokens = tagger.tagRawTokens(tokens.map((t) => t.value));

  const comparisonResult = handleMoreLess(taggedTokens);
  if (comparisonResult) return comparisonResult;

  // Find main verb (non-auxiliary)
  const verbIndex = taggedTokens.findIndex((t) => t.pos?.startsWith("V") && !isAuxiliaryWord(t.value));

  if (verbIndex === -1) {
    return tokens.map((t) => t.value).join(" ") + " of";
  }

  // Handle single verb
  if (tokens.length === 1) {
    return `${toPastParticiple(tokens[0].value)} by`;
  }

  // Check for auxiliary patterns
  const hasModalHave =
    verbIndex >= 2 &&
    perfectModalPhrases.has(`${tokens[verbIndex - 2].value} ${tokens[verbIndex - 1].value}`.toLowerCase());
  const hasSingleAux = verbIndex > 0 && isAuxiliaryWord(tokens[verbIndex - 1].value);

  // Convert verb to past participle
  tokens[verbIndex].value = toPastParticiple(tokens[verbIndex].value);

  // Insert appropriate auxiliary form
  if (hasModalHave || hasSingleAux) {
    tokens.splice(verbIndex, 0, { value: hasModalHave ? "been" : "be" });
  }

  return tokens.map((t) => t.value).join(" ") + " by";
}
