# Hash map

Turn a key into an array index, store the value there, read it back in constant
time. This is the structure behind JavaScript's own objects and `Map`, and
behind every cache key in the [caching
module](../../backends/learning/backend-concepts/caching/).

| File | What's in it |
|---|---|
| `hashmap.ts` | `HashMap<V>` — open addressing with linear probing, and resizing |

## How it works here

`keyToIndex` sums the character codes of the key and takes it modulo the table
size. Two different keys can land on the same index — that is a **collision**,
and it is not an edge case, it is guaranteed once you have more keys than slots.

There are two families of fix. This one uses **open addressing**: on a collision,
walk forward to the next free slot (linear probing). The other is **chaining**:
each slot holds a list of entries. Open addressing keeps everything in one array,
which is friendlier to CPU caches; chaining degrades more gracefully when the
table gets full.

`Slot<V>` is `[key, value] | null`, and that union is what makes the probe loop
honest: a slot you have not checked yet might be empty, so the code cannot treat
it as a pair until it has looked.

## Why it resizes at 0.7

Load factor is entries divided by slots. As it climbs, probe sequences get
longer, and near 1.0 lookups degrade to a linear scan — the O(1) becomes O(n).
Doubling the table at 0.7 keeps the average probe short.

Resizing is not cheap: every entry has to be re-inserted, because a bigger table
means a different modulo and therefore different indexes. It is O(n), and it is
amortised away by only happening when the table doubles.

Note that `insert` calls `resize()` first and `resize()` calls `insert()` for
each old entry. That recursion terminates because after doubling, the load factor
is at most 0.35, so the nested call never resizes again.

## What a real implementation does differently

Summing character codes is a bad hash: `"ab"` and `"ba"` collide, and so does
every anagram. Production hashes (FNV-1a, xxHash, SipHash) mix the bits so that
similar keys land far apart. `keyToIndex` is under a "don't touch below this
line" marker because the exercise is about probing and resizing, not hashing —
but do not carry it anywhere.

## Run

```bash
npm test -- d-structs-algos/hashmap
```
