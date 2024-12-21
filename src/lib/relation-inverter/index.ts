import defaultDictionary from "./dictionary.json";
import { guessInverse } from "./morphology";

// The dictionary maps from label to inverse label, but we want to be able to
// look up the inverse label to get the label. For example, the dictionary
// contains "founder" -> "founder of", but we want to be able to look up
// "founder of" to get "founder". Here we create a bidirectional dictionary to
// support this.
const bidirectionalDictionary: Record<string, string> = {};
for (const [key, value] of Object.entries(defaultDictionary)) {
  bidirectionalDictionary[key] = value;
  bidirectionalDictionary[value] = key;
}

export function getInverseRelation(
  relation: string,
  dictionary: Record<string, string> = bidirectionalDictionary,
): string {
  const trimmedRelation = relation.trim();

  if (dictionary[trimmedRelation]) {
    return dictionary[trimmedRelation];
  }
  return guessInverse(trimmedRelation);
}
