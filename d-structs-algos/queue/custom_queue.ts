// `items` stays public because the matchmake tests assert against it directly.
class Queue<T> {
  items: T[] = [];

  push(item: T): void {
    this.items.unshift(item);
  }

  pop(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.pop() ?? null;
  }

  peek(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.at(-1) ?? null;
  }

  size(): number {
    return this.items.length;
  }

  searchAndRemove(item: T): T | null {
    const index = this.items.indexOf(item);
    if (index === -1) {
      return null;
    }
    this.items.splice(index, 1);
    return item;
  }

  toString(): string {
    return `[${this.items.join(", ")}]`;
  }
}

export { Queue };
