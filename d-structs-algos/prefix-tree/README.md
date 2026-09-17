# Prefix tree (trie)

A tree where the path from the root spells the key. Words sharing a prefix share
the nodes for it, so "car", "card" and "care" are one chain of three nodes with a
fork at the end.

| File | What's in it |
|---|---|
| `prefix_tree.ts` | `PrefixTree` — insert, exists, and prefix search |

## The cost that makes it worth it

Lookup is **O(k)** in the length of the key, and does not depend on how many
words are stored. A hash map is also O(1)-ish for exact lookup, so for `exists`
alone a trie buys you nothing.

The difference is the question "what starts with `car`?". A hash map cannot
answer that without scanning every key. A trie walks three nodes and then reads
everything below, which is why autocomplete, routers and IP prefix matching are
built this way.

## The `"*"` marker

Nodes are plain objects mapping a letter to the node below. End-of-word is stored
in the same object under `"*"`, which is why a value is `TrieNode | true` and why
`descend` exists.

Without that marker you could not tell a stored word from a prefix of one: after
inserting "card", walking "car" lands on a real node, but "car" was never
inserted. `exists` checks for the marker; the prefix search does not.

That union is the one wrinkle in the design. Keying the marker off `"*"` means a
key containing a literal `*` would collide with it — fine for lowercase words,
not fine in general. The tidier version puts the flag on the node itself
(`{ children: {}, isWord: false }`) at the cost of an extra object per node.

## Run

```bash
npm test -- d-structs-algos/prefix-tree
```
