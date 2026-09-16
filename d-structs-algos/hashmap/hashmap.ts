// An open-addressing hash map with linear probing. Each slot is either empty
// (null) or a [key, value] pair, which the Slot type spells out — so a slot can
// never be silently treated as a pair before it has been checked.
type Slot<V> = [key: string, value: V] | null;

class HashMap<V> {
  hashmap: Slot<V>[];

  constructor(size: number) {
    this.hashmap = new Array<Slot<V>>(size).fill(null);
  }

  insert(key: string, value: V): void {
    this.resize();
    let index = this.keyToIndex(key);
    const originalIndex = index;
    let firstIteration = true;
    // noUncheckedIndexedAccess types an array read as `Slot<V> | undefined`.
    // Probing only ever lands on a real index, so `?? null` folds the
    // out-of-range case back into "empty slot".
    let slot = this.hashmap[index] ?? null;
    while (slot !== null && slot[0] !== key) {
      if (!firstIteration && index === originalIndex) {
        throw new Error("hashmap is full");
      }
      index = (index + 1) % this.hashmap.length;
      firstIteration = false;
      slot = this.hashmap[index] ?? null;
    }
    this.hashmap[index] = [key, value];
  }

  get(key: string): V {
    let index = this.keyToIndex(key);
    const originalIndex = index;
    let firstIteration = true;
    let slot = this.hashmap[index] ?? null;
    while (slot !== null) {
      if (slot[0] === key) {
        return slot[1];
      }
      if (!firstIteration && index === originalIndex) {
        throw new Error("hashmap is full");
      }
      index = (index + 1) % this.hashmap.length;
      firstIteration = false;
      slot = this.hashmap[index] ?? null;
    }
    throw new Error("sorry, key not found");
  }

  resize(): void {
    if (this.hashmap.length === 0) {
      this.hashmap = [null];
      return;
    }
    const load = this.currentLoad();
    if (load >= 0.7) {
      // The predicate is a type guard, so oldEntries is [string, V][] rather
      // than (Slot<V>)[] and the destructuring below needs no extra checks.
      const oldEntries = this.hashmap.filter(
        (pair): pair is [string, V] => pair !== null
      );
      this.hashmap = new Array<Slot<V>>(2 * this.hashmap.length).fill(null);
      for (const [key, value] of oldEntries) {
        this.insert(key, value);
      }
    }
  }

  currentLoad(): number {
    if (this.hashmap.length === 0) {
      return 1;
    }
    let filled = 0;
    for (const pair of this.hashmap) {
      if (pair !== null) {
        filled += 1;
      }
    }
    return filled / this.hashmap.length;
  }

  // don't touch below this line

  keyToIndex(key: string): number {
    let total = 0;
    for (const c of key) {
      total += c.charCodeAt(0);
    }
    return total % this.hashmap.length;
  }

  toString(): string {
    let final = "";
    for (const v of this.hashmap) {
      if (v !== null) {
        final += ` - ${v}\n`;
      }
    }
    return final;
  }
}

export { HashMap };
export type { Slot };
