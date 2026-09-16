// A trie node maps one letter to the node below it. The end-of-word marker lives
// in the same object under "*", so a value is either another node or `true`.
// That union is the whole reason the descent below needs a guard: reading
// node[letter] can hand back the marker, not a node.
type TrieNode = { [letter: string]: TrieNode | true };

const END_SYMBOL = "*";

// Narrows one step down the trie. Returns undefined for both "no such letter"
// and "that letter is the end marker", which are the two cases every walk
// already had to stop on.
function descend(node: TrieNode, letter: string): TrieNode | undefined {
  const next = node[letter];
  return next === undefined || next === true ? undefined : next;
}

class PrefixTree {
  root: TrieNode = {};
  endSymbol: string = END_SYMBOL;

  insert(word: string): void {
    let current = this.root;
    for (const c of word) {
      let next = descend(current, c);
      if (next === undefined) {
        next = {};
        current[c] = next;
      }
      current = next;
    }
    current[this.endSymbol] = true;
  }

  exists(word: string): boolean {
    let current = this.root;
    for (const letter of word) {
      const next = descend(current, letter);
      if (next === undefined) {
        return false;
      }
      current = next;
    }
    return this.endSymbol in current;
  }

  searchLevel(currentLevel: TrieNode, currentPrefix: string, words: string[]): void {
    if (this.endSymbol in currentLevel) {
      words.push(currentPrefix);
    }
    for (const [letter, nextLevel] of Object.entries(currentLevel)) {
      // `nextLevel === true` is the end marker, which the letter check already
      // skipped in the JS version. Stating it also narrows the type.
      if (letter !== this.endSymbol && nextLevel !== true) {
        this.searchLevel(nextLevel, currentPrefix + letter, words);
      }
    }
  }

  wordsWithPrefix(prefix: string): string[] {
    let current = this.root;
    for (const letter of prefix) {
      const next = descend(current, letter);
      if (next === undefined) {
        return [];
      }
      current = next;
    }
    const words: string[] = [];
    this.searchLevel(current, prefix, words);
    return words;
  }

  findMatches(document: string): Set<string> {
    const matches = new Set<string>();
    for (let i = 0; i < document.length; i++) {
      let currentLevel: TrieNode = this.root;
      for (let j = i; j < document.length; j++) {
        const char = document[j];
        if (char === undefined) {
          break;
        }
        const next = descend(currentLevel, char);
        if (next === undefined) {
          break;
        }
        currentLevel = next;
        if (this.endSymbol in currentLevel) {
          matches.add(document.slice(i, j + 1));
        }
      }
    }
    return matches;
  }

  advancedFindMatches(
    document: string,
    variations: Record<string, string>
  ): Set<string> {
    const matches = new Set<string>();
    for (let i = 0; i < document.length; i++) {
      let currentLevel: TrieNode = this.root;
      for (let j = i; j < document.length; j++) {
        const char = document[j];
        if (char === undefined) {
          break;
        }
        const canonical = variations[char] ?? char;
        const next = descend(currentLevel, canonical);
        if (next === undefined) {
          break;
        }
        currentLevel = next;
        if (this.endSymbol in currentLevel) {
          matches.add(document.slice(i, j + 1));
        }
      }
    }
    return matches;
  }

  longestCommonPrefix(): string {
    let prefix = "";
    let current = this.root;
    while (Object.keys(current).length === 1 && !(this.endSymbol in current)) {
      const letter = Object.keys(current)[0];
      if (letter === undefined) {
        break;
      }
      const next = descend(current, letter);
      if (next === undefined) {
        break;
      }
      prefix += letter;
      current = next;
    }
    return prefix;
  }
}

export { PrefixTree };
export type { TrieNode };
