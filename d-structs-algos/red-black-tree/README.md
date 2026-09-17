# Red-black tree

A binary search tree that rebalances itself as you insert, so it cannot degrade
into a linked list.

| File | What's in it |
|---|---|
| `red_black_tree.ts` | `RBTree<T>`, `RBNode<T>` — insert with recolouring and rotations |
| `user.ts` | A `User` type with comparison operators, for trying it on non-numbers |

## The problem it solves

Read [searching/binary-search-tree](../searching/binary-search-tree/) first. A
plain BST is O(log n) only while it stays bushy. Insert 1, 2, 3, 4, 5 in order
and every node becomes a right child: the tree is a linked list with extra steps,
and search is O(n).

Sorted input is not a rare case. It is what you get inserting rows by
autoincrement id, or events by timestamp — which is to say, the common case.

## The rules

Each node is red or black, and every insert restores five invariants:

1. Every node is red or black.
2. The root is black.
3. All leaves (the nulls) are black.
4. A red node's children are both black — no two reds in a row.
5. Every path from a node down to a leaf passes through the same number of black
   nodes.

Rules 4 and 5 together bound the height at 2·log₂(n+1). The longest path can be
at most twice the shortest, because the longest alternates red and black while
the shortest is all black. That bound is the guarantee: **O(log n) worst case**,
not just on average.

Restoring them after an insert is recolouring plus up to two rotations, which is
O(log n) and where the implementation's complexity lives.

## Where you have already used one

This is not an academic structure. `TreeMap` and `TreeSet` in Java, `std::map`
in C++, the Linux kernel's process scheduler, and the index behind most
`ORDER BY` queries are all red-black trees or their close cousin the B-tree.
When [database-concepts/indexes](../../backends/learning/database-concepts/indexes/)
says an index makes a range query fast, this is the shape doing it.

## Run

```bash
npm test -- d-structs-algos/red-black-tree
```
