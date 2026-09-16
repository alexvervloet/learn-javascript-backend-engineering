import { test, expect } from "@jest/globals";
import { selectionSort } from "./selection_sort.js";

const cases: [number[], number[]][] = [
  [[5, 3, 8, 6, 1, 9], [1, 3, 5, 6, 8, 9]],
  [[10, 9, 8, 7, 6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  [[15, 12, 8, 7, 5, 3, 1], [1, 3, 5, 7, 8, 12, 15]],
  [[10, 5, 3, 7, 2, 8, 1], [1, 2, 3, 5, 7, 8, 10]],
  [[], []],
  [[1], [1]],
];

test.each(cases)("selectionSort(%p)", (input, expected) => {
  expect(selectionSort(input)).toEqual(expected);
});
