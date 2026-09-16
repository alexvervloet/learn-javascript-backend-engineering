import { test, expect } from "@jest/globals";
import { isBalanced } from "./balanced.js";

const cases: [string, boolean][] = [
  ["(", false],
  ["()", true],
  ["(())", true],
  ["()()", true],
  ["(()))", false],
  ["((())())", true],
  ["(()(()", false],
  [")(", false],
  [")()(()", false],
  ["())(()", false],
];

test.each(cases)("isBalanced(%p)", (input, expected) => {
  expect(isBalanced(input)).toBe(expected);
});
