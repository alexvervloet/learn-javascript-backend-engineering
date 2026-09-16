import { test, expect } from "@jest/globals";
import { binarySearch } from "./binary_search.js";

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

const cases: [number, number[], boolean][] = [
  [10, range(200), true],
  [-1, range(20000), false],
  [15, [], false],
  [0, [0], true],
  [-1, [-2, -1], true],
  [105028, range(2000000), true],
  [2000001, range(2000000), false],
];

test.each(cases)("binarySearch finds target (case %#)", (target, arr, expected) => {
  expect(binarySearch(target, arr)).toBe(expected);
});
