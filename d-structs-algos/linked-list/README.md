# Linked list

A chain of nodes, each holding a value and a reference to the next one. There is
no contiguous block of memory and no index arithmetic — to reach the fifth item
you walk through four others.

| File | What's in it |
|---|---|
| `node.ts` | `Node<T>` — one value, one `next` pointer |
| `linked_list.ts` | `LinkedList<T>` — head/tail insert and remove, iterable |

## What it costs

| Operation | Cost | Why |
|---|---|---|
| `addToHead` | O(1) | Point the new node at the old head |
| `addToTail` | O(1) | The list keeps a `tail` reference |
| `removeFromHead` | O(1) | Move `head` along one |
| `removeFromTail` | **O(n)** | Nothing points *backwards*, so finding the second-to-last node means walking from the head |

That last row is the whole argument for a doubly linked list: add a `prev`
pointer and removal from the tail drops to O(1), at the cost of another reference
per node and two pointers to fix on every write instead of one.

Compare against an array: an array gives you O(1) random access and this does
not. A linked list gives you O(1) insertion in the middle *if you already hold
the node*, and an array does not. Neither is better; they fail in different
places.

## `next` is `Node<T> | null`

That is the type doing real work. Every walk through the list has to handle
reaching the end, and because the null is in the type, the compiler will not let
you forget. `removeFromTail` has a guard inside its loop that a human can see is
unreachable — past the `head === tail` check there are at least two nodes — and
the comment above it says so rather than reaching for `!`.

## Iteration

`LinkedList` implements `[Symbol.iterator]`, so it works with `for...of` and
spreads. It yields **nodes**, not values, so reach for `.val`:

```ts
for (const node of list) console.log(node.val);
```

## Run

```bash
npm test -- d-structs-algos/linked-list
```
