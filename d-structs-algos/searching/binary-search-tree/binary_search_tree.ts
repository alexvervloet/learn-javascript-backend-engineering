// The tree holds plain numbers in some tests and User objects in others. In JS
// that worked because `a < b` coerces an object through valueOf(), and User
// defines valueOf() to return its id.
//
// TypeScript only allows < between two numbers, two strings or two bigints, so
// there is no type-level equivalent of that implicit coercion. Making it
// explicit is the fix: Number() calls the same valueOf(), so the ordering is
// exactly what it was, and Comparable states the requirement the JS version
// left unwritten.
type Comparable = number | { valueOf(): number };

function lessThan(a: Comparable, b: Comparable): boolean {
  return Number(a) < Number(b);
}

function greaterThan(a: Comparable, b: Comparable): boolean {
  return Number(a) > Number(b);
}

class BinarySearchTreeNode<T extends Comparable> {
  val: T | null;
  left: BinarySearchTreeNode<T> | null = null;
  right: BinarySearchTreeNode<T> | null = null;

  constructor(val: T | null = null) {
    this.val = val;
  }

  insert(val: T): void {
    if (this.val === null) {
      this.val = val;
      return;
    }
    if (lessThan(val, this.val)) {
      if (this.left === null) {
        this.left = new BinarySearchTreeNode<T>(val);
      } else {
        this.left.insert(val);
      }
    } else {
      if (this.right === null) {
        this.right = new BinarySearchTreeNode<T>(val);
      } else {
        this.right.insert(val);
      }
    }
  }

  delete(val: T): BinarySearchTreeNode<T> | null {
    if (this.val === null) {
      return this;
    }
    if (lessThan(val, this.val)) {
      if (this.left !== null) {
        this.left = this.left.delete(val);
      }
    } else if (greaterThan(val, this.val)) {
      if (this.right !== null) {
        this.right = this.right.delete(val);
      }
    } else {
      if (this.left === null) {
        return this.right;
      } else if (this.right === null) {
        return this.left;
      }
      let minLargerNode = this.right;
      while (minLargerNode.left !== null) {
        minLargerNode = minLargerNode.left;
      }
      // The in-order successor of a node with two children always holds a
      // value, but its type is T | null like every other node's, so the
      // recursive delete needs the null ruled out first.
      const successorVal = minLargerNode.val;
      this.val = successorVal;
      if (successorVal !== null) {
        this.right = this.right.delete(successorVal);
      }
    }
    return this;
  }

  preorder(visited: T[]): T[] {
    if (this.val) {
      visited.push(this.val);
    }
    if (this.left) {
      this.left.preorder(visited);
    }
    if (this.right) {
      this.right.preorder(visited);
    }
    return visited;
  }

  postorder(visited: T[]): T[] {
    if (this.left) {
      this.left.postorder(visited);
    }
    if (this.right) {
      this.right.postorder(visited);
    }
    if (this.val) {
      visited.push(this.val);
    }
    return visited;
  }

  inorder(result: T[] = []): T[] {
    if (this.left) {
      this.left.inorder(result);
    }
    if (this.val !== null) {
      result.push(this.val);
    }
    if (this.right) {
      this.right.inorder(result);
    }
    return result;
  }

  exists(val: T): boolean {
    if (this.val === val) {
      return true;
    }
    if (this.val !== null && lessThan(val, this.val)) {
      if (this.left) {
        return this.left.exists(val);
      }
    }
    if (this.val !== null && greaterThan(val, this.val)) {
      if (this.right) {
        return this.right.exists(val);
      }
    }
    return false;
  }

  height(): number {
    let left = 0;
    let right = 0;
    if (!this.val) {
      return 0;
    }
    if (this.left) {
      left = this.left.height();
    }
    if (this.right) {
      right = this.right.height();
    }
    return Math.max(left, right) + 1;
  }
}

export { BinarySearchTreeNode };
export type { Comparable };
