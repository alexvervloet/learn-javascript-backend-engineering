# Data Structures & Algorithms

The CS fundamentals, in TypeScript, with no setup. Every folder here is plain
Node — no database, no Redis, no Docker. If you are working through the repo in
order, this is where you start.

## Why this is first

Two reasons, and neither is "interviews".

The first is that the rest of the repo assumes you can reason about cost. When
the `n-plus-one` module says a query went from 1 to N round trips, or the
`caching` module says a stampede means N concurrent misses, those are the same
shapes you build here in the small. It is easier to see O(n²) in a nineteen-line
bubble sort than in an ORM call that hides the loop.

The second is that these are the smallest programs in the repo, so they are the
cheapest place to get used to how it is set up: native ESM, `.js` extensions on
relative imports even though the files are `.ts`, `npx tsx` to run, Jest for the
tests. Getting comfortable with that here costs nothing.

## The map

| Folder | Structure or algorithm | Key operations | Cost |
|---|---|---|---|
| [stack/](stack/) | Stack (LIFO) | push, pop, peek | O(1) each |
| [queue/](queue/) | Queue (FIFO) | push, pop, peek | O(1) pop, O(n) push here — see the folder |
| [linked-list/](linked-list/) | Singly linked list | add/remove head or tail | O(1), except remove-from-tail at O(n) |
| [hashmap/](hashmap/) | Hash map, open addressing | insert, get | O(1) average, O(n) worst |
| [prefix-tree/](prefix-tree/) | Trie | insert, exists, prefix search | O(k) in the key's length, not the item count |
| [searching/](searching/) | Binary search, binary search tree | search, insert, delete, traversals | O(log n) when balanced, O(n) when not |
| [red-black-tree/](red-black-tree/) | Self-balancing BST | insert with rotations | O(log n) guaranteed |
| [sorting/](sorting/) | Bubble, insertion, selection, merge, quick | sort | O(n²) for the first three, O(n log n) for the last two |
| [graph/](graph/) | Adjacency list and adjacency matrix | add edge, BFS | list vs matrix is a space/lookup trade |
| [p-v-np/](p-v-np/) | Subset sum, travelling salesman | solve vs verify | exponential to solve, polynomial to check |

## Running things

```bash
npm install                         # once, from the repo root
npm test -- d-structs-algos         # every suite here
npm test -- d-structs-algos/sorting # or just one folder
```

Each folder has a test file that doubles as its usage examples. Reading
`stack.test.ts` next to `stack.ts` is usually faster than reading prose about a
stack.

To poke at something by hand, write a scratch file next to it and run it
directly:

```ts
// scratch.ts
import { Stack } from "./stack.js";   // .js, even though the file is stack.ts
const s = new Stack<number>();
s.push(1);
console.log(s.pop());
```

```bash
npx tsx d-structs-algos/stack/scratch.ts
```

The `.js` extension on a relative import is not a typo. Node's ESM resolver
requires the extension as it appears at runtime, and `tsx` and Jest map it back
to the `.ts` source. The repo root README has the longer version.

## A note on strictness

The repo runs TypeScript's `strict`, but deliberately without
`noUncheckedIndexedAccess`. That flag types `nums[i]` as `number | undefined`,
which is genuinely useful where an index comes from outside the code — a hash
probe, a `Map.get` — and pure noise in a sort loop whose bounds you can see three
lines up. Turning it on added four errors to bubble sort and caught zero bugs.
`LESSONS.md` at the repo root has the reasoning.

Where a lookup really can miss, these files say so in the types: `adjacentNodes`
returns `Set<number> | null`, `descend` in the trie returns `TrieNode |
undefined`. That is the part worth copying.
