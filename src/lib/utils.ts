import { type ClassValue, clsx } from "clsx";

import { SearchAndReplaceDropdownOption } from '@/app/graph/SettingsStore';

// Utility function to combine class names
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Calculate a similarity score between two strings
export function scoreMatch(text: string, query: string) {
  const normalizedText = text.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedText === normalizedQuery) return 1; // Exact match

  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex === -1) return 0; // No match

  // Score based on match position (earlier is better)
  const positionScore = 1 - matchIndex / normalizedText.length;

  // Score based on length similarity (closer lengths are better)
  const lengthScore = normalizedQuery.length / normalizedText.length;

  // Combine scores, favoring position over length
  return 0.8 * positionScore + 0.2 * lengthScore;
}

// Common constants for text matching
const VALID_CHARS = () => `.`; // Placeholder for valid characters
const MAX_LENGTH = 75;
const MAX_ALIAS_LENGTH = 50;
const PUNCTUATION = "\\.,\\+\\*\\?\\$\\@\\|{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

// Define valid joining characters between words
const VALID_JOINS =
    "(?:" +
    "\\.[ |$]|" + // e.g., "Dr. " in "Dr. Smith"
    " |" + // Simple space
    "[" + PUNCTUATION + "]|" + // Any punctuation
    ")";

// Interface for text match results
export interface MenuTextMatch {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
}

// Create a regex for matching based on triggers and length limits
function createMatchRegex(triggers: string, maxLength: number = MAX_LENGTH, matchOnlyStart: boolean = false): RegExp {
  if (triggers === '') {
    // Match any non-punctuation and non-whitespace characters
    return new RegExp(`${matchOnlyStart ? '^' : '(^|\\s)'}(${VALID_CHARS()}{1,${maxLength}})$`);
  }
  
  // Match trigger followed by valid characters
  return new RegExp(
    triggers === ';' 
      ? `^(;(${VALID_CHARS()}{0,${maxLength}}))$`
      : `${matchOnlyStart ? '^' : '(^|\\s|\\()'}([${triggers}](${VALID_CHARS()}{0,${maxLength}}))$`
  );
}

// Check for a match in the text based on triggers and matching rules
function checkForMatch(text: string, triggers: string, matchOnlyStart: boolean = false): MenuTextMatch | null {
  const regex = createMatchRegex(triggers, MAX_LENGTH, matchOnlyStart);
  const match = regex.exec(text);

  // Special case: if the last character is a trigger, match the whole string
  if (!matchOnlyStart && triggers.includes(text[text.length - 1])) {
    return {
      leadOffset: 0,
      matchingString: text,
      replaceableString: text
    };
  }

  if (match !== null) {
    const leadingWhitespace = matchOnlyStart ? '' : (match[1] || '');
    const matchingString = triggers === '' ? match[2] : match[matchOnlyStart ? 2 : 3];
    return {
      leadOffset: match.index + leadingWhitespace.length,
      matchingString,
      replaceableString: match[matchOnlyStart ? 1 : 2],
    };
  }
  return null;
}

// Check for a search and replace match when text starts with a semicolon
function checkForSearchAndReplaceOnSemiColonAtStart(text: string): MenuTextMatch | null {
  return checkForMatch(text, ';', true);
}

// Check for any search and replace match in the text
function checkForSearchAndReplaceMatchAny(text: string): MenuTextMatch | null {
  return checkForMatch(text, '', false);
}

// Check for a mention match in the text (starting with '@')
export function checkForMentionMatch(text: string): MenuTextMatch | null {
  const MENTION_TRIGGER = "@";
  const VALID_MENTION_CHARS = `[^${MENTION_TRIGGER}${PUNCTUATION}\\s]`;

  const mentionRegex = new RegExp(
    `(^|\\s|\\()([${MENTION_TRIGGER}]((?:${VALID_MENTION_CHARS}${VALID_JOINS}){0,${MAX_LENGTH}}))$`
  );

  const aliasRegex = new RegExp(
    `(^|\\s|\\()([${MENTION_TRIGGER}]((?:${VALID_MENTION_CHARS}){0,${MAX_ALIAS_LENGTH}}))$`
  );

  let match = mentionRegex.exec(text) || aliasRegex.exec(text);

  if (match !== null) {
    const leadingWhitespace = match[1];
    const matchingString = match[3];
    return {
      leadOffset: match.index + leadingWhitespace.length,
      matchingString,
      replaceableString: match[2],
    };
  }
  return null;
}

// Check for a search and replace match based on configuration and context
export function checkForSearchAndReplaceMatch(
  text: string, 
  isLabellingRelation: boolean, 
  config: SearchAndReplaceDropdownOption
): MenuTextMatch | null {
  switch (config) {
    case SearchAndReplaceDropdownOption.Always:
      return checkForSearchAndReplaceMatchAny(text);

    case SearchAndReplaceDropdownOption.ColonOrSemiColon:
      return isLabellingRelation
        ? checkForSearchAndReplaceMatchAny(text)
        : checkForSearchAndReplaceOnSemiColonAtStart(text);

    case SearchAndReplaceDropdownOption.SemicolonOnly:
    default:
      return checkForSearchAndReplaceOnSemiColonAtStart(text);
  }
}