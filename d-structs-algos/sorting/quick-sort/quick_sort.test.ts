import { test, expect } from "@jest/globals";
import { quickSort } from "./quick_sort.js";

const cases: [number[], number, number, number[]][] = [
  [[2, 1, 3], 0, 2, [1, 2, 3]],
  [[9, 6, 2, 1, 8, 7], 0, 5, [1, 2, 6, 7, 8, 9]],
  [[], 0, -1, []],
  [[1], 0, 0, [1]],
  [[1, 2, 3, 4, 5], 0, 4, [1, 2, 3, 4, 5]],
  [[5, 4, 3, 2, 1], 0, 4, [1, 2, 3, 4, 5]],
  [[0, 1, 6, 4, 7, 3, 2, 8, 5, -9], 0, 9, [-9, 0, 1, 2, 3, 4, 5, 6, 7, 8]],
];

test.each(cases)("quickSort sorts in place (case %#)", (input, low, high, expected) => {
  const result = [...input];
  quickSort(result, low, high);
  expect(result).toEqual(expected);
});
