# Queue

First in, first out. Add at one end, remove from the other. Where a stack gives
you the newest item, a queue gives you the oldest, which is what you want any
time fairness matters: job queues, request buffers, breadth-first search.

| File | What's in it |
|---|---|
| `custom_queue.ts` | `Queue<T>` — push, pop, peek, size, searchAndRemove |
| `matchmake.ts` | `matchmake(queue, [name, action])` — a lobby that pairs players |

## The cost hiding in `push`

`push` uses `items.unshift(...)`, which is **O(n)**: every existing element
shifts up one slot. `pop` is O(1). So this queue is O(1) out, O(n) in.

That is fine for a teaching implementation and wrong for a hot path. The real
fixes, in increasing order of effort:

- Push to the end and shift from the front instead. `Array.prototype.shift` is
  also O(n) in the general case, so this just moves the problem.
- Keep a head index and never remove: `pop` returns `items[head++]` and you
  compact occasionally. O(1) amortised.
- A ring buffer over a fixed array, or a doubly linked list. O(1) always.

Node's own queues (`bullmq`, which this repo uses in
[task-queue-concepts](../../backends/learning/task-queue-concepts/)) are not
arrays at all — they are Redis lists, which are linked lists underneath, for
exactly this reason.

`items` is public rather than private because the matchmaking tests assert
against it directly.

## `searchAndRemove` is not a queue operation

Pulling an item out of the middle breaks the FIFO contract, and it is here
because real lobbies need it: a player who joined and then quit should not be
matched. It is O(n), since finding them means scanning.

## Run

```bash
npm test -- d-structs-algos/queue
```
