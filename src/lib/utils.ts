import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function scoreMatch(text: string, query: string) {
  const procText = text.toLowerCase().trim();
  const procQuery = query.toLowerCase().trim();

  if (procText === procQuery) return 1;

  const matchIndex = procText.indexOf(procQuery);
  if (matchIndex === -1) return 0;

  // Calculate the base score based on match location
  const locationScore = 1 - matchIndex / procText.length;

  // Calculate a length ratio to favor shorter matches
  const lengthRatio = procQuery.length / procText.length;

  // Combine the scores, giving more weight to the location score
  return 0.8 * locationScore + 0.2 * lengthRatio;
}
