import { test, expect } from "@jest/globals";
import { Node } from "./node.js";

function nodeListToArray(node: Node<string>): string[] {
  const result: string[] = [];
  let current: Node<string> | null = node;
  while (current) {
    result.push(current.val);
    current = current.next;
  }
  return result;
}

function getLastNode(node: Node<string>): Node<string> {
  let current = node;
  while (current.next) {
    current = current.next;
  }
  return current;
}

const cases: [string, string[]][] = [
  ["Anton Chigurh", ["Llewelyn Moss", "Anton Chigurh"]],
  ["Carson Wells", ["Llewelyn Moss", "Anton Chigurh", "Carson Wells"]],
  ["Ed Tom Bell", ["Llewelyn Moss", "Anton Chigurh", "Carson Wells", "Ed Tom Bell"]],
  [
    "Carla Jean Moss",
    ["Llewelyn Moss", "Anton Chigurh", "Carson Wells", "Ed Tom Bell", "Carla Jean Moss"],
  ],
  [
    "Wendell",
    [
      "Llewelyn Moss",
      "Anton Chigurh",
      "Carson Wells",
      "Ed Tom Bell",
      "Carla Jean Moss",
      "Wendell",
    ],
  ],
];

test("setNext appends nodes to the end of the chain", () => {
  const head = new Node("Llewelyn Moss");
  for (const [input, expectedState] of cases) {
    const node = new Node(input);
    getLastNode(head).setNext(node);
    expect(nodeListToArray(head)).toEqual(expectedState);
  }
});
