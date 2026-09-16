import { test, expect } from "@jest/globals";
import { Stack } from "./stack.js";

// Annotating the tuple shape keeps test.each's callback parameters typed as
// (string[], number) instead of collapsing to a union of both.
const cases: [string[], number][] = [
  [["a", "b", "c"], 3],
  [["x"], 1],
  [[], 0],
  [["a", "b", "c", "d", "e"], 5],
];

test.each(cases)("size after pushing %p", (items, expectedSize) => {
  const s = new Stack<string>();
  for (const item of items) {
    s.push(item);
  }
  expect(s.size()).toBe(expectedSize);
});

test("peek and pop behave as a LIFO stack", () => {
  const s = new Stack<string>();
  expect(s.peek()).toBeNull();
  expect(s.pop()).toBeNull();
  s.push("a");
  s.push("b");
  expect(s.peek()).toBe("b");
  expect(s.pop()).toBe("b");
  expect(s.pop()).toBe("a");
});
