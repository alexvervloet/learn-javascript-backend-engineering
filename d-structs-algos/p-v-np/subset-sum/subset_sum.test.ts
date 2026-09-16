import { test, expect } from "@jest/globals";
import { subsetSum } from "./subset_sum.js";

const cases: [number[], number, boolean][] = [
  [[3, 34, 4, 12, 5, 2], 9, true],
  [[1, 2, 3], 7, false],
  [[1, 2, 3, 8, 9, 10], 7, false],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9], 15, true],
  [[3, 2, 7, 1], 6, true],
  [[10, 20, 30, 40, 50], 60, true],
  [
    [1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
    500,
    false,
  ],
];

test.each(cases)("subsetSum(%p, %p) === %p", (nums, target, expected) => {
  expect(subsetSum(nums, target)).toBe(expected);
});
