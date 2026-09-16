import { test, expect } from "@jest/globals";
import { RBTree } from "./red_black_tree.js";
import type { RBNode } from "./red_black_tree.js";
import { getUsers, User } from "./user.js";

function inorder(node: RBNode<User> | null, NIL: RBNode<User>): User[] {
  if (node === NIL || node === null) {
    return [];
  }
  const val = node.val;
  return [
    ...inorder(node.left, NIL),
    ...(val === null ? [] : [val]),
    ...inorder(node.right, NIL),
  ];
}

function hasDoubleRed(node: RBNode<User> | null, NIL: RBNode<User>): boolean {
  if (node === NIL || node === null) {
    return false;
  }
  if (node.red) {
    const leftRed = node.left !== null && node.left !== NIL && node.left.red;
    const rightRed = node.right !== null && node.right !== NIL && node.right.red;
    if (leftRed || rightRed) {
      return true;
    }
  }
  return hasDoubleRed(node.left, NIL) || hasDoubleRed(node.right, NIL);
}

function blackHeight(node: RBNode<User> | null, NIL: RBNode<User>): number {
  if (node === NIL || node === null) {
    return 0;
  }
  const leftBh = blackHeight(node.left, NIL);
  const rightBh = blackHeight(node.right, NIL);
  if (leftBh === -1 || rightBh === -1 || leftBh !== rightBh) {
    return -1;
  }
  return leftBh + (node.red ? 0 : 1);
}

const cases = [4, 8, 10];

test.each(cases)("RBTree stays valid after inserting %p users", (numUsers) => {
  const users = getUsers(numUsers);
  const tree = new RBTree<User>();
  for (const user of users) {
    tree.insert(user);
  }

  const traversal = inorder(tree.root, tree.NIL);

  const isSorted = traversal.every(
    (val, i) => i === 0 || Number(traversal[i - 1]) < Number(val)
  );
  const traversalIds = traversal.map((u) => u.id).sort((a, b) => a - b);
  const userIds = users.map((u) => u.id).sort((a, b) => a - b);

  expect(isSorted).toBe(true);
  expect(traversalIds).toEqual(userIds);
  expect(tree.root.red).toBe(false);
  expect(hasDoubleRed(tree.root, tree.NIL)).toBe(false);
  expect(blackHeight(tree.root, tree.NIL)).not.toBe(-1);
});
