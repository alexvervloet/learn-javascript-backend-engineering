import { Node } from "./node.js";

class LinkedList<T> {
  head: Node<T> | null = null;
  tail: Node<T> | null = null;

  *[Symbol.iterator](): Generator<Node<T>> {
    let node = this.head;
    while (node !== null) {
      yield node;
      node = node.next;
    }
  }

  addToHead(node: Node<T>): void {
    if (this.head === null) {
      this.tail = node;
    }
    node.setNext(this.head);
    this.head = node;
  }

  addToTail(node: Node<T>): void {
    if (this.head === null || this.tail === null) {
      this.head = node;
      this.tail = node;
      return;
    }
    this.tail.setNext(node);
    this.tail = node;
  }

  removeFromHead(): Node<T> | undefined {
    if (this.head === null) {
      return undefined;
    }
    const removing = this.head;
    this.head = this.head.next;
    if (this.head === null) {
      this.tail = null;
    }
    removing.setNext(null);
    return removing;
  }

  removeFromTail(): Node<T> | undefined {
    if (this.tail === null) {
      return undefined;
    }
    const removing = this.tail;
    if (this.head === this.tail) {
      this.head = null;
      this.tail = null;
      return removing;
    }
    // Past the head === tail check the list has at least two nodes, so the walk
    // below always finds the node before the tail. The compiler cannot see that,
    // hence the explicit null guard inside the loop.
    let current = this.head;
    while (current !== null && current.next !== this.tail) {
      current = current.next;
    }
    if (current === null) {
      return undefined;
    }
    current.setNext(null);
    this.tail = current;
    return removing;
  }

  toString(): string {
    const nodes: T[] = [];
    let current = this.head;
    while (current !== null && current.val !== undefined) {
      nodes.push(current.val);
      current = current.next;
    }
    return nodes.join(" -> ");
  }
}

export { LinkedList };
