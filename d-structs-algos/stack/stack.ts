// A stack is generic over what it holds: Stack<string> and Stack<number> are
// different types, and the compiler keeps them apart without any runtime cost.
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  size(): number {
    return this.items.length;
  }

  peek(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    // `at(-1)` is typed as `T | undefined`, so the empty check above is not
    // enough on its own to satisfy the compiler. `?? null` bridges the gap.
    return this.items.at(-1) ?? null;
  }

  pop(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.pop() ?? null;
  }
}

export { Stack };
