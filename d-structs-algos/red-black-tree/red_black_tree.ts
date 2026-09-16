// A red-black tree, with the NIL sentinel the classic formulation uses: one
// shared black leaf node that stands in for "no child".
//
// That sentinel is why every node's `val` is `T | null` — NIL has no value. It
// is also why the code below captures values into locals before comparing them.
// The algorithm guarantees a comparison never reaches NIL, but the type does not
// say so, and inventing a value for NIL would be worse than checking.
//
// As in the binary search tree, ordering goes through Number() rather than `<`,
// because the tree is exercised with User objects whose valueOf() returns an id.
type Comparable = number | { valueOf(): number };

function lessThan(a: Comparable, b: Comparable): boolean {
  return Number(a) < Number(b);
}

function greaterThan(a: Comparable, b: Comparable): boolean {
  return Number(a) > Number(b);
}

class RBNode<T extends Comparable> {
  val: T | null;
  red = false;
  left: RBNode<T> | null = null;
  right: RBNode<T> | null = null;
  parent: RBNode<T> | null = null;

  constructor(val: T | null = null) {
    this.val = val;
  }
}

class RBTree<T extends Comparable> {
  NIL: RBNode<T>;
  root: RBNode<T>;

  constructor() {
    this.NIL = new RBNode<T>();
    this.root = this.NIL;
  }

  insert(val: T): void {
    const node = new RBNode<T>(val);
    node.red = true;
    node.left = this.NIL;
    node.right = this.NIL;

    let parent: RBNode<T> | null = null;
    let current: RBNode<T> | null = this.root;
    while (current !== this.NIL && current !== null) {
      parent = current;
      const currentVal = current.val;
      if (currentVal === null) {
        break;
      }
      if (lessThan(val, currentVal)) {
        current = current.left;
      } else if (greaterThan(val, currentVal)) {
        current = current.right;
      } else {
        return;
      }
    }

    node.parent = parent;
    if (parent === null) {
      this.root = node;
    } else if (parent.val !== null && lessThan(val, parent.val)) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this._fixInsert(node);
  }

  _fixInsert(node: RBNode<T>): void {
    while (node.parent !== null && node.parent.red) {
      let p: RBNode<T> = node.parent;
      let gp: RBNode<T> | null = p.parent;
      // The root is always black, so a red parent always has a grandparent.
      // The compiler cannot see that. The JS version would have thrown a
      // TypeError here rather than carry on, so stopping matches it.
      if (gp === null) {
        break;
      }

      if (p === gp.left) {
        const uncle = gp.right;
        if (uncle !== null && uncle.red) {
          p.red = false;
          uncle.red = false;
          gp.red = true;
          node = gp;
        } else {
          if (node === p.right) {
            node = p;
            this._rotateLeft(node);
            const newParent = node.parent;
            const newGrandparent = newParent?.parent ?? null;
            if (newParent === null || newGrandparent === null) {
              break;
            }
            p = newParent;
            gp = newGrandparent;
          }
          p.red = false;
          gp.red = true;
          this._rotateRight(gp);
        }
      } else {
        const uncle = gp.left;
        if (uncle !== null && uncle.red) {
          p.red = false;
          uncle.red = false;
          gp.red = true;
          node = gp;
        } else {
          if (node === p.left) {
            node = p;
            this._rotateRight(node);
            const newParent = node.parent;
            const newGrandparent = newParent?.parent ?? null;
            if (newParent === null || newGrandparent === null) {
              break;
            }
            p = newParent;
            gp = newGrandparent;
          }
          p.red = false;
          gp.red = true;
          this._rotateLeft(gp);
        }
      }
    }
    this.root.red = false;
  }

  _rotateLeft(x: RBNode<T>): void {
    const y = x.right;
    if (y === null) {
      return;
    }
    x.right = y.left;
    if (y.left !== null && y.left !== this.NIL) {
      y.left.parent = x;
    }
    y.parent = x.parent;
    if (x.parent === null) {
      this.root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }
    y.left = x;
    x.parent = y;
  }

  _rotateRight(x: RBNode<T>): void {
    const y = x.left;
    if (y === null) {
      return;
    }
    x.left = y.right;
    if (y.right !== null && y.right !== this.NIL) {
      y.right.parent = x;
    }
    y.parent = x.parent;
    if (x.parent === null) {
      this.root = y;
    } else if (x === x.parent.right) {
      x.parent.right = y;
    } else {
      x.parent.left = y;
    }
    y.right = x;
    x.parent = y;
  }
}

export { RBNode, RBTree };
export type { Comparable };
