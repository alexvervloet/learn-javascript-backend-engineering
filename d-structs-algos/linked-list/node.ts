// Node<T> is generic so a list of strings and a list of numbers stay distinct.
// `next` is `Node<T> | null`, which is the part that earns its keep: every place
// that walks the chain now has to deal with the end of it.
class Node<T> {
  val: T;
  next: Node<T> | null = null;

  constructor(val: T) {
    this.val = val;
  }

  setNext(node: Node<T> | null): void {
    this.next = node;
  }

  toString(): string {
    // The JS version returned `this.val` directly, which only worked because
    // every caller happened to store strings. String() makes that explicit.
    return String(this.val);
  }
}

export { Node };
