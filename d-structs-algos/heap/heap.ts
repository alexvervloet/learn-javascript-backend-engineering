// A binary min-heap, stored in a flat array.
//
// The shape is a complete binary tree: every level full except possibly the
// last, which fills left to right. That is what lets the tree live in an array
// with no pointers at all — the arithmetic below replaces them.
//
//   parent(i) = (i - 1) >> 1      left(i) = 2i + 1      right(i) = 2i + 2
//
//   index:  0   1   2   3   4   5
//   value: [1,  3,  5,  7,  9,  6]
//
//                  1
//                /   \
//               3     5
//              / \   /
//             7   9 6
//
// The heap property is weaker than a sorted array: a parent is <= both of its
// children, and that is all. Siblings are unordered, the array is not sorted,
// and only the root is guaranteed to be the minimum. That weakness is the point
// — maintaining it costs O(log n) instead of the O(n) a sorted array would pay
// to keep a full ordering nobody asked for.
//
// The comparator decides the ordering, so a max-heap is the same class with the
// arguments the other way round.
class MinHeap<T> {
  private items: T[] = [];
  // (a, b) => negative when a should come out first. Same contract as
  // Array.prototype.sort, so the comparators are interchangeable.
  //
  // Declared as a field and assigned in the body rather than as a constructor
  // parameter property (`constructor(private compare: ...)`). That shorthand
  // emits code, so it is not erasable TypeScript, and this repo runs its .ts
  // files directly — see `erasableSyntaxOnly` in tsconfig.json.
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  size(): number {
    return this.items.length;
  }

  peek(): T | null {
    return this.items.length === 0 ? null : (this.items[0] ?? null);
  }

  // Put the new item at the end — the only place that keeps the tree complete —
  // then walk it up until its parent is smaller. O(log n): the tree is balanced
  // by construction, so the walk is bounded by its height.
  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  // The root is the answer, but removing it leaves a hole. Fill it with the last
  // item (again, the only removal that keeps the tree complete) and sift that
  // down to where it belongs.
  pop(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    const top = this.items[0] ?? null;
    const last = this.items.pop();
    // length > 0 means the popped item was not the root itself.
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  // Building a heap from an array is O(n), not O(n log n) as pushing each item
  // one at a time would be. The reason is that sifting down is cheap for most
  // nodes: half the tree is leaves and costs nothing, a quarter sits one level
  // up and costs one swap, and the sum converges. Starting from the last parent
  // and walking backwards is what makes each call's subtrees already valid.
  static from<T>(items: T[], compare: (a: T, b: T) => number): MinHeap<T> {
    const heap = new MinHeap<T>(compare);
    heap.items = [...items];
    for (let i = (heap.items.length >> 1) - 1; i >= 0; i--) {
      heap.siftDown(i);
    }
    return heap;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compareAt(i, parent) >= 0) {
        break;
      }
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const n = this.items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;

      // Compare against BOTH children and swap with the smaller one. Swapping
      // with the left child whenever it is smaller than the parent is the
      // classic bug: it can leave the new parent larger than its right child,
      // which breaks the heap property silently — pop keeps working and just
      // returns the wrong element.
      if (left < n && this.compareAt(left, smallest) < 0) {
        smallest = left;
      }
      if (right < n && this.compareAt(right, smallest) < 0) {
        smallest = right;
      }
      if (smallest === i) {
        return;
      }
      this.swap(i, smallest);
      i = smallest;
    }
  }

  // The non-null assertions are safe: every caller has already bounds-checked
  // against this.items.length, and the heap never stores holes.
  private compareAt(a: number, b: number): number {
    return this.compare(this.items[a]!, this.items[b]!);
  }

  private swap(a: number, b: number): void {
    const tmp = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = tmp;
  }
}

// A priority queue is a min-heap with the priority stored next to the value, so
// callers never write a comparator. The two names get used interchangeably;
// "heap" is the structure, "priority queue" is the job it is doing.
class PriorityQueue<T> {
  private heap = new MinHeap<{ priority: number; value: T }>((a, b) => a.priority - b.priority);

  push(value: T, priority: number): void {
    this.heap.push({ priority, value });
  }

  pop(): T | null {
    return this.heap.pop()?.value ?? null;
  }

  peek(): T | null {
    return this.heap.peek()?.value ?? null;
  }

  size(): number {
    return this.heap.size();
  }
}

// Repeatedly popping the minimum yields a sorted array. That is heapsort, and it
// is O(n log n) with no extra allocation beyond the heap itself. Worth knowing
// because it connects this folder to sorting/: a heap is what makes selection
// sort's "find the smallest remaining" step cheap, turning O(n²) into O(n log n).
function heapSort<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  const heap = MinHeap.from(items, compare);
  const out: T[] = [];
  for (;;) {
    const next = heap.pop();
    if (next === null) {
      return out;
    }
    out.push(next);
  }
}

export { MinHeap, PriorityQueue, heapSort };
