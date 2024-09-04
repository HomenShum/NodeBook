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
export const REGEX_CONSTANTS = {
  VALID_CHARS: ".",
  MAX_LENGTH: 75,
  MAX_ALIAS_LENGTH: 50,
  PUNCTUATION: "\\.,\\+\\*\\?\\$\\@\\|{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;",
  VALID_JOINS: "(?:\\.[ |$]| |[\\.,\\+\\*\\?\\$\\@\\|{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;]|)",
  MENTION_TRIGGER: "@",
};

// Interface for text match results
export interface MenuTextMatch {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
}

// Interface for checkForMatch parameters
interface CheckForMatchParams {
  text: string;
  triggers: string;
  matchOnlyStart?: boolean;
  maxLength?: number;
}

// Create a regex for matching based on triggers and length limits
function createMatchRegex({ triggers, maxLength = REGEX_CONSTANTS.MAX_LENGTH, matchOnlyStart = false }: CheckForMatchParams): RegExp {
  if (triggers === '') {
    return new RegExp(`${matchOnlyStart ? '^' : '(^|\\s)'}(${REGEX_CONSTANTS.VALID_CHARS}{1,${maxLength}})$`);
  }
  
  return new RegExp(
    triggers === ';' 
      ? `^(;(${REGEX_CONSTANTS.VALID_CHARS}{0,${maxLength}}))$`
      : `${matchOnlyStart ? '^' : '(^|\\s|\\()'}([${triggers}](${REGEX_CONSTANTS.VALID_CHARS}{0,${maxLength}}))$`
  );
}

// Check for a match in the text based on triggers and matching rules
function checkForMatch({ text, triggers, matchOnlyStart = false, maxLength = REGEX_CONSTANTS.MAX_LENGTH }: CheckForMatchParams): MenuTextMatch | null {
  const regex = createMatchRegex({ text, triggers, maxLength, matchOnlyStart });
  const match = regex.exec(text);

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
  return checkForMatch({ text, triggers: ';', matchOnlyStart: true });
}

// Check for any search and replace match in the text
function checkForSearchAndReplaceMatchAny(text: string): MenuTextMatch | null {
  return checkForMatch({ text, triggers: '' });
}

// Check for a mention match in the text (starting with '@')
const VALID_MENTION_CHARS = `[^${REGEX_CONSTANTS.MENTION_TRIGGER}${REGEX_CONSTANTS.PUNCTUATION}\\s]`;

const mentionRegex = new RegExp(
  `(^|\\s|\\()([${REGEX_CONSTANTS.MENTION_TRIGGER}]((?:${VALID_MENTION_CHARS}${REGEX_CONSTANTS.VALID_JOINS}){0,${REGEX_CONSTANTS.MAX_LENGTH}}))$`
);

const aliasRegex = new RegExp(
  `(^|\\s|\\()([${REGEX_CONSTANTS.MENTION_TRIGGER}]((?:${VALID_MENTION_CHARS}){0,${REGEX_CONSTANTS.MAX_ALIAS_LENGTH}}))$`
);
export function checkForMentionMatch(text: string): MenuTextMatch | null {
  let match = mentionRegex.exec(text) || aliasRegex.exec(text);
  if (!match) return null;
  const leadingWhitespace = match[1];
  const matchingString = match[3];
  return {
    leadOffset: match.index + leadingWhitespace.length,
    matchingString,
    replaceableString: match[2],
  };
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

    case SearchAndReplaceDropdownOption.LabelledOnly:
      return isLabellingRelation
        ? checkForSearchAndReplaceMatchAny(text)
        : checkForSearchAndReplaceOnSemiColonAtStart(text);

    case SearchAndReplaceDropdownOption.SemicolonOnly:
    default:
      return checkForSearchAndReplaceOnSemiColonAtStart(text);
  }
}
