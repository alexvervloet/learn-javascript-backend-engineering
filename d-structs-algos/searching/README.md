# Searching

Finding things faster than looking at everything, and the structure that keeps
it that way.

| Folder | What's in it |
|---|---|
| [binary-search/](binary-search/) | `binarySearch(target, arr)` over a sorted array |
| [binary-search-tree/](binary-search-tree/) | `BinarySearchTreeNode<T>` — insert, delete, exists, traversals, height |

## Binary search

Halve the range each step: O(log n). For a million elements that is 20
comparisons instead of a million.

The precondition is the whole story — **the array must already be sorted**. If
it is not, binary search does not return a wrong answer slowly, it returns a
wrong answer quickly, and nothing tells you. The function cannot check without
doing O(n) work and defeating the point, so the obligation sits with the caller.

That precondition is also the cost model. Sorting to enable one search is O(n log
n), worse than just scanning. Sorting once to enable many searches is the trade
that pays.

## Binary search tree

The same idea as a structure: every node's left subtree is smaller, right
subtree is larger. Search, insert and delete are all O(h) where h is the height.

For a balanced tree h is log n. For a degenerate one h is n, and you have built a
linked list. Inserting sorted data does exactly that — see
[red-black-tree/](../red-black-tree/), which exists to stop it.

### Traversals

- `inorder` visits left, node, right, so it yields the values **in sorted
  order**. This is the traversal you usually want.
- `preorder` visits node first — useful for copying a tree, since it emits
  parents before children.
- `postorder` visits node last — useful for freeing or for evaluating an
  expression tree bottom-up.

`inorder` takes an optional accumulator and returns it; `preorder` and
`postorder` require one to be passed in.

### Delete is the hard one

Removing a node with no children is trivial and with one child is easy. With two
children you have to promote a replacement that preserves the ordering: either
the largest value in the left subtree or the smallest in the right. That is the
case worth reading the implementation for.

## Run

```bash
npm test -- d-structs-algos/searching
```
