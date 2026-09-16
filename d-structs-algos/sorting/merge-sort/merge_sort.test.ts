import { test, expect } from "@jest/globals";
import { mergeSort } from "./merge_sort.js";

const cases: [number[], number[]][] = [
  [[3, 2, 1], [1, 2, 3]],
  [[5, 4, 3, 2, 1], [1, 2, 3, 4, 5]],
  [[], []],
  [[7], [7]],
  [[4, -7, 1, 0, 5], [-7, 0, 1, 4, 5]],
  [[9, 8, 7, 6, 5, 4, 3, 2, 1, 0], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
];

test.each(cases)("mergeSort(%p)", (input, expected) => {
  expect(mergeSort(input)).toEqual(expected);
});
