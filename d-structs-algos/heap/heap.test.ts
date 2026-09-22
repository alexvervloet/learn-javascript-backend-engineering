import { describe, test, expect } from "@jest/globals";
import { MinHeap, PriorityQueue, heapSort } from "./heap.js";

const numeric = (a: number, b: number): number => a - b;

// The heap property is the invariant everything else rests on, so it is checked
// directly rather than inferred from pop order: every parent <= both children.
// Reading the private array is deliberate — this asserts the internal shape,
// which is exactly what a structural bug would break while pop still looked fine.
function isValidHeap<T>(heap: MinHeap<T>, compare: (a: T, b: T) => number): boolean {
  const items = (heap as unknown as { items: T[] }).items;
  for (let i = 0; i < items.length; i++) {
    const left = 2 * i + 1;
    const right = left + 1;
    if (left < items.length && compare(items[i]!, items[left]!) > 0) return false;
    if (right < items.length && compare(items[i]!, items[right]!) > 0) return false;
  }
  return true;
}

// Deterministic PRNG so a failure is reproducible, matching red-black-tree/.
function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("MinHeap", () => {
  test("an empty heap peeks and pops null", () => {
    const heap = new MinHeap<number>(numeric);
    expect(heap.size()).toBe(0);
    expect(heap.peek()).toBeNull();
    expect(heap.pop()).toBeNull();
  });

  test("pops in ascending order", () => {
    const heap = new MinHeap<number>(numeric);
    for (const n of [5, 3, 8, 1, 9, 2, 7]) heap.push(n);
    const out: number[] = [];
    for (;;) {
      const next = heap.pop();
      if (next === null) break;
      out.push(next);
    }
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  test("peek returns the minimum without removing it", () => {
    const heap = new MinHeap<number>(numeric);
    for (const n of [4, 2, 6]) heap.push(n);
    expect(heap.peek()).toBe(2);
    expect(heap.size()).toBe(3);
  });

  test("duplicates all come back", () => {
    const heap = new MinHeap<number>(numeric);
    for (const n of [3, 1, 3, 1, 3]) heap.push(n);
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual([1, 1, 3, 3, 3]);
  });

  test.each([10, 50, 200])("stays a valid heap through %p random pushes and pops", (n) => {
    const rng = mulberry32(7);
    const heap = new MinHeap<number>(numeric);
    const reference: number[] = [];

    for (let i = 0; i < n; i++) {
      const value = Math.floor(rng() * 1000);
      heap.push(value);
      reference.push(value);
      expect(isValidHeap(heap, numeric)).toBe(true);
    }

    // Popping half should still leave a valid heap behind.
    reference.sort(numeric);
    for (let i = 0; i < n / 2; i++) {
      expect(heap.pop()).toBe(reference[i]);
      expect(isValidHeap(heap, numeric)).toBe(true);
    }
  });

  test("a reversed comparator gives a max-heap", () => {
    const heap = new MinHeap<number>((a, b) => b - a);
    for (const n of [5, 3, 8, 1]) heap.push(n);
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual([8, 5, 3, 1]);
  });

  test("from() builds a valid heap in one pass", () => {
    const items = [9, 4, 7, 1, 8, 2, 6, 3, 5];
    const heap = MinHeap.from(items, numeric);
    expect(isValidHeap(heap, numeric)).toBe(true);
    expect(heap.peek()).toBe(1);
    expect(heap.size()).toBe(items.length);
  });

  test("from() does not mutate the caller's array", () => {
    const items = [3, 1, 2];
    MinHeap.from(items, numeric);
    expect(items).toEqual([3, 1, 2]);
  });

  test("sorts objects by a field", () => {
    interface Job {
      name: string;
      cost: number;
    }
    const heap = new MinHeap<Job>((a, b) => a.cost - b.cost);
    heap.push({ name: "slow", cost: 30 });
    heap.push({ name: "fast", cost: 5 });
    heap.push({ name: "medium", cost: 12 });
    expect(heap.pop()?.name).toBe("fast");
    expect(heap.pop()?.name).toBe("medium");
  });
});

describe("PriorityQueue", () => {
  test("pops the lowest priority number first", () => {
    const queue = new PriorityQueue<string>();
    queue.push("write the code", 2);
    queue.push("the server is down", 0);
    queue.push("answer the email", 5);
    expect(queue.pop()).toBe("the server is down");
    expect(queue.pop()).toBe("write the code");
    expect(queue.pop()).toBe("answer the email");
    expect(queue.pop()).toBeNull();
  });

  test("peek does not consume", () => {
    const queue = new PriorityQueue<string>();
    queue.push("a", 1);
    expect(queue.peek()).toBe("a");
    expect(queue.size()).toBe(1);
  });
});

describe("heapSort", () => {
  test.each([
    [[], []],
    [[1], [1]],
    [[3, 1, 2], [1, 2, 3]],
    [[5, 5, 5], [5, 5, 5]],
    [[9, 8, 7, 6, 5], [5, 6, 7, 8, 9]],
  ])("sorts %p", (input, expected) => {
    expect(heapSort(input, numeric)).toEqual(expected);
  });

  test("agrees with Array.sort on random input", () => {
    const rng = mulberry32(11);
    const items = Array.from({ length: 300 }, () => Math.floor(rng() * 10_000));
    expect(heapSort(items, numeric)).toEqual([...items].sort(numeric));
  });
});
