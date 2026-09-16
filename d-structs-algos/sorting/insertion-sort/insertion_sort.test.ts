import { test, expect } from "@jest/globals";
import { insertionSort } from "./insertion_sort.js";

const cases: [number[], number[]][] = [
  [[4, 3, 2, 1], [1, 2, 3, 4]],
  [[9, 5, -3, 7], [-3, 5, 7, 9]],
  [[], []],
  [[1], [1]],
  [[5, 3, 4, 1, 2], [1, 2, 3, 4, 5]],
  [[0, -2, -5, 3, 2, 1], [-5, -2, 0, 1, 2, 3]],
  [[9, 8, 7, 6, 5, 4, 3, 2, 1, 0], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
];

test.each(cases)("insertionSort(%p)", (input, expected) => {
  expect(insertionSort(input)).toEqual(expected);
});
