# Heap & Priority Queue

A heap answers one question fast: *what is the smallest thing I have?* It does
not sort. That restraint is where the speed comes from.

| Operation | Cost | Note |
|---|---|---|
| `peek` | O(1) | the root is always the minimum |
| `push` | O(log n) | append, then sift up |
| `pop` | O(log n) | take the root, move the last item up, sift down |
| `MinHeap.from` | O(n) | not O(n log n) — see below |
| `heapSort` | O(n log n) | n pops, each O(log n) |

## The array trick

A heap is a *complete* binary tree: every level full except the last, which
fills left to right. That constraint means the tree can live in a flat array,
with arithmetic standing in for pointers.

```
parent(i) = (i - 1) >> 1      left(i) = 2i + 1      right(i) = 2i + 2

index:  0   1   2   3   4   5
value: [1,  3,  5,  7,  9,  6]

                1
              /   \
             3     5
            / \   /
           7   9 6
```

No node objects, no `left`/`right` fields, no allocation per insert, and the
whole structure sits in one contiguous block of memory. Compare with
[red-black-tree/](../red-black-tree/), which needs real nodes because it is not
complete.

## Why it is not sorted

Look at `[1, 3, 5, 7, 9, 6]` again. It satisfies the heap property — every
parent is smaller than both its children — and it is not in sorted order. 6 sits
after 9.

That is the entire trade. A sorted array gives you the minimum in O(1) too, but
costs O(n) per insert to keep everything ordered. A heap only promises that the
root is the minimum, so an insert only has to fix one path from a leaf up to the
root, which is O(log n) because the tree is balanced by construction.

You pay for what you use. If you never ask "what is the third smallest", never
pay to know it.

## Building in O(n)

Pushing n items one at a time is n × O(log n). `MinHeap.from` does better by
sifting *down* from the last parent backwards, which is O(n) overall.

The intuition is that sift-down is cheap for most of the tree. Half the nodes
are leaves and cost nothing. A quarter sit one level up and cost at most one
swap. An eighth cost two. The expensive nodes near the root are the rare ones,
and the sum converges to a constant times n rather than growing with log n.

## Where this shows up

- **[Dijkstra](../graph/dijkstra/)** — repeatedly "closest unvisited vertex".
  Without a heap that scan is O(V) each time and the algorithm is O(V²).
- **Task queues** — [task-queue-concepts/](../../backends/learning/task-queue-concepts/)
  runs on BullMQ, whose delayed jobs are a priority queue keyed on run-at time.
  So is every OS scheduler and every timer wheel.
- **Top-k** — the k largest of a stream in O(n log k) with a k-sized heap, never
  holding more than k items in memory. This is what a "top 10" query does when
  it refuses to sort the whole table.
- **Merging sorted streams** — one heap entry per stream; pop the smallest head,
  advance that stream. The merge step of an external sort, and of most log
  aggregators.

## Min or max

There is no separate `MaxHeap` here. Reverse the comparator:

```ts
new MinHeap<number>((a, b) => b - a)   // now pops the largest first
```

The comparator follows the same contract as `Array.prototype.sort`, so anything
that sorts one way sorts a heap the other.

## Run

```bash
npm test -- d-structs-algos/heap
```
