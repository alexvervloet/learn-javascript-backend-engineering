# Sorting

Five sorting algorithms, plus one example of sorting by a computed key. The
value here is not that you will write a sort — `Array.prototype.sort` is right
there — it is that these are the smallest honest examples of O(n²) versus
O(n log n), and you can see the difference in nineteen lines.

| Folder | Algorithm | Average | Worst | Stable | In place |
|---|---|---|---|---|---|
| [bubble-sort/](bubble-sort/) | Bubble sort | O(n²) | O(n²) | yes | yes |
| [insertion-sort/](insertion-sort/) | Insertion sort | O(n²) | O(n²) | yes | yes |
| [selection-sort/](selection-sort/) | Selection sort | O(n²) | O(n²) | no | yes |
| [merge-sort/](merge-sort/) | Merge sort | O(n log n) | O(n log n) | yes | no — O(n) extra |
| [quick-sort/](quick-sort/) | Quicksort | O(n log n) | **O(n²)** | no | yes |
| [sorted/](sorted/) | Sorting by a derived key | — | — | — | — |

**Stable** means equal elements keep their original relative order. It matters
more than it sounds: sort by date, then by author, and a stable sort leaves each
author's rows still in date order.

## Reading the table

The three O(n²) sorts are not interchangeable. Insertion sort is O(n) on
already-sorted input and is genuinely the fastest option for small or
nearly-sorted arrays — real library sorts fall back to it below about 10-20
elements. Selection sort always does the same number of comparisons regardless
of input, but the fewest possible swaps, which matters when a swap is expensive.
Bubble sort's only real claim is that it is easy to explain.

Quicksort's worst case is the interesting row. `partition` here takes the last
element as the pivot, so an already-sorted array gives you the worst possible
split — one element on one side, everything else on the other — and n levels of
recursion instead of log n. Sorted input, again, being the common case. Real
implementations pick the pivot with median-of-three or randomly, which makes the
bad case vanishingly unlikely without removing it.

Merge sort has no such cliff, which is why it is the choice when you need a
guarantee. You pay for it in memory.

## What `Array.prototype.sort` actually does

V8 uses TimSort: merge sort with runs of insertion sort, exploiting the fact that
real data usually has sorted stretches in it. It is stable, O(n log n) worst
case, and O(n) on sorted input. Also note the default comparator sorts
*lexicographically*, so `[10, 9].sort()` gives `[10, 9]`. Always pass a
comparator for numbers.

## Signatures differ

Most of these take an array and return it, mutating in place.
[quick-sort/](quick-sort/) takes `(nums, low, high)` and returns `void`, because
the recursion needs the bounds; call it as `quickSort(nums, 0, nums.length - 1)`.

[sorted/](sorted/) is the odd one out — not an algorithm but the everyday case of
sorting by something you compute rather than the value itself, with a comparator.
It is also the only one that copies rather than mutating.

## Run

```bash
npm test -- d-structs-algos/sorting
```
