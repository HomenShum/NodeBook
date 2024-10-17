import { reaction } from "mobx";

import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "trie" });

const SEP = /[\s/]+/;

export interface CappedKeywordIndex {
  add(id: string, getText: () => string): void;
  delete(id: string): void;
  getIds(text: string): string[];
  clear(): void;
}

export class KeywordTrieIndex implements CappedKeywordIndex {
  root: TrieNode = new TrieNode();
  maxPrefixLength: number;
  reactionDisposersById: Map<string, Set<() => void>> = new Map();
  allIds: Set<string> = new Set();

  constructor(maxPrefixLength: number) {
    this.maxPrefixLength = maxPrefixLength;
  }

  /**
   * Add a new object to the index. For the index to stay up to date, the
   * `getText` function should reference a MobX observable.
   */
  add(id: string, getText: () => string) {
    const disposer = reaction(
      getText,
      (text) => {
        logger.debug("Update object in trie", { id, text });
        this.removeFromTrie(id);
        this.addIdToTrie(id, text);
      },
      { fireImmediately: true },
    );
    const disposers = this.reactionDisposersById.get(id) || new Set();
    disposers.add(disposer);
    this.reactionDisposersById.set(id, disposers);
  }

  delete(id: string) {
    logger.debug("Delete object from trie", { id });
    const disposers = this.reactionDisposersById.get(id);
    disposers?.forEach((disposer) => disposer());
    this.reactionDisposersById.delete(id);
    this.removeFromTrie(id);
  }

  /**
   * Returns the ids of all objects matching the query. An object is considered
   * a match if, for every word in the query, the object contains a word which
   * matches the query word's first few characters (number of characters is
   * determined by {@link maxPrefixLength}).
   *
   * Note that this means the result may contain objects whose text does not
   * contain the query. It's up to the caller to filter the results further if
   * necessary.
   */
  getIds(text: string): string[] {
    const keywords = text
      .toLocaleLowerCase()
      .split(SEP)
      .filter((word) => word.length > 0);
    let ids: Set<string> | null = null;
    for (let word of keywords) {
      let node = this.root;
      for (let i = 0; i < Math.min(word.length, this.maxPrefixLength); i++) {
        const char = word[i];
        if (!node.childrenByNextChar.has(char)) {
          break;
        }
        node = node.childrenByNextChar.get(char)!;
      }
      ids = ids === null ? new Set(node.ids) : new Set([...ids].filter((id: string) => node.ids.has(id)));
    }
    return ids ? Array.from(ids) : [];
  }

  clear() {
    this.root = new TrieNode();
    this.reactionDisposersById.forEach((disposers) => disposers?.forEach((disposer) => disposer()));
    this.reactionDisposersById.clear();
    this.allIds.clear();
  }

  private addIdToTrie(id: string, content: string) {
    const words = content.toLocaleLowerCase().split(SEP);
    for (const word of words) {
      let node = this.root;
      for (let i = 0; i < Math.min(word.length, this.maxPrefixLength); i++) {
        const char = word[i];
        if (!node.childrenByNextChar.has(char)) {
          node.childrenByNextChar.set(char, new TrieNode(char));
        }
        node = node.childrenByNextChar.get(char)!;
        node.ids.add(id);
      }
    }
    this.allIds.add(id);
  }

  private removeFromTrie(id: string) {
    if (!this.allIds.has(id)) {
      return;
    }

    const stack: { node: TrieNode; parent: TrieNode | null }[] = [{ node: this.root, parent: null }];

    while (stack.length > 0) {
      const { node, parent } = stack.pop()!;

      node.ids.delete(id);

      if (parent && node.ids.size === 0) {
        parent.childrenByNextChar.delete(node.char);
      } else {
        node.childrenByNextChar.forEach((childNode) => {
          stack.push({ node: childNode, parent: node });
        });
      }
    }

    this.allIds.delete(id);
  }
}

class TrieNode {
  char: string = "";
  childrenByNextChar: Map<string, TrieNode> = new Map();
  ids: Set<string> = new Set();
  constructor(char: string = "") {
    this.char = char;
  }
}

/**
 * A no-op implementation used when the index is not needed to avoid the overhead of maintaining it.
 *
 * Specifically useful for anonymous access mode where the user cannot enter any of the edit
 * flows where the index is used. Avoiding constructing/updating the index saves significant
 * start-up time.
 */
export class NoopKeywordIndex implements CappedKeywordIndex {
  add() {}
  delete() {}
  getIds() {
    return [];
  }
  clear() {}
}
