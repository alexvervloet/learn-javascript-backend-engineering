import { test, expect } from "@jest/globals";
import { bubbleSort } from "./bubble_sort.js";

const cases: [number[], number[]][] = [
  [[5, 7, 3, 6, 8], [3, 5, 6, 7, 8]],
  [[2, 1], [1, 2]],
  [[], []],
  [[1], [1]],
  [[1, 5, -3, 2, 4], [-3, 1, 2, 4, 5]],
  [[9, 8, 7, 6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 6, 7, 8, 9]],
  [[1, 3, 2, 5, 4], [1, 2, 3, 4, 5]],
];

test.each(cases)("bubbleSort(%p)", (input, expected) => {
  expect(bubbleSort(input)).toEqual(expected);
});
