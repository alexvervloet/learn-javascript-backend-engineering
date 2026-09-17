import { test, expect } from "@jest/globals";
import { tsp, verifyTsp, permutations } from "./traveling_salesman.js";
import type { DistanceMatrix } from "./traveling_salesman.js";

const cases: [number[], DistanceMatrix, number, boolean][] = [
  [[0, 1], [[0, 394], [394, 0]], 3458, true],
  [[0, 1, 2], [[0, 911, 430], [911, 0, 41], [430, 41, 0]], 3104, true],
  [[0, 1], [[0, 394], [394, 0]], 300, false],
  [
    [0, 1, 2, 3],
    [
      [0, 988, 523, 497],
      [988, 0, 850, 940],
      [523, 850, 0, 802],
      [497, 940, 802, 0],
    ],
    1877,
    true,
  ],
  [
    [0, 1, 2, 3, 4],
    [
      [0, 310, 991, 488, 366],
      [310, 0, 597, 913, 929],
      [991, 597, 0, 223, 516],
      [488, 913, 223, 0, 142],
      [366, 929, 516, 142, 0],
    ],
    3399,
    true,
  ],
  [
    [0, 1, 2, 3, 4, 5],
    [
      [0, 143, 773, 97, 633, 818],
      [143, 0, 256, 931, 545, 722],
      [773, 256, 0, 829, 616, 923],
      [97, 931, 829, 0, 150, 317],
      [633, 545, 616, 150, 0, 101],
      [818, 722, 923, 317, 101, 0],
    ],
    3399,
    true,
  ],
  [
    [0, 1, 2, 3, 4, 5, 6],
    [
      [0, 75, 920, 870, 700, 338, 483],
      [75, 0, 573, 103, 362, 444, 323],
      [920, 573, 0, 625, 655, 934, 209],
      [870, 103, 625, 0, 989, 565, 488],
      [700, 362, 655, 989, 0, 453, 886],
      [338, 444, 934, 565, 453, 0, 533],
      [483, 323, 209, 488, 886, 533, 0],
    ],
    2989,
    true,
  ],
  [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [
      [0, 63, 824, 940, 561, 937, 14, 95],
      [63, 0, 736, 860, 408, 727, 844, 803],
      [824, 736, 0, 684, 640, 1, 626, 505],
      [940, 860, 684, 0, 847, 888, 341, 249],
      [561, 408, 640, 847, 0, 747, 333, 720],
      [937, 727, 1, 888, 747, 0, 891, 64],
      [14, 844, 626, 341, 333, 891, 0, 195],
      [95, 803, 505, 249, 720, 64, 195, 0],
    ],
    1066,
    false,
  ],
  [
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [
      [0, 581, 227, 244, 822, 990, 145, 822, 556],
      [581, 0, 458, 93, 82, 327, 896, 520, 955],
      [227, 458, 0, 501, 111, 308, 564, 298, 723],
      [244, 93, 501, 0, 127, 560, 340, 834, 944],
      [822, 82, 111, 127, 0, 553, 208, 986, 818],
      [990, 327, 308, 560, 553, 0, 617, 560, 601],
      [145, 896, 564, 340, 208, 617, 0, 294, 455],
      [822, 520, 298, 834, 986, 560, 294, 0, 93],
      [556, 955, 723, 944, 818, 601, 455, 93, 0],
    ],
    3756,
    true,
  ],
];

test.each(cases)("tsp finds path shorter than %#", (cities, paths, dist, expected) => {
  expect(tsp(cities, paths, dist)).toBe(expected);
});

// verifyTsp is the other half of the module's point: finding a route is the hard
// direction, checking one someone hands you is the easy one. It was exported and
// never exercised.

const SQUARE: DistanceMatrix = [
  [0, 10, 15, 20],
  [10, 0, 35, 25],
  [15, 35, 0, 30],
  [20, 25, 30, 0],
];

test("verifyTsp accepts a route inside the budget", () => {
  // 0 -> 1 -> 3 -> 2  =  10 + 25 + 30  =  65
  expect(verifyTsp(SQUARE, 65, [0, 1, 3, 2])).toBe(true);
  expect(verifyTsp(SQUARE, 100, [0, 1, 3, 2])).toBe(true);
});

test("verifyTsp rejects a route over the budget", () => {
  expect(verifyTsp(SQUARE, 64, [0, 1, 3, 2])).toBe(false);
});

test("verifyTsp measures the route it is given, not the best one", () => {
  // 0 -> 2 -> 1 -> 3  =  15 + 35 + 25  =  75, worse than the 65 above.
  // A verifier checks one claim; it does not go looking for a better answer.
  expect(verifyTsp(SQUARE, 70, [0, 2, 1, 3])).toBe(false);
  expect(tsp([0, 1, 2, 3], SQUARE, 70)).toBe(true);
});

test("a route tsp accepts is one verifyTsp accepts", () => {
  const budget = 65;
  expect(tsp([0, 1, 2, 3], SQUARE, budget)).toBe(true);
  const witness = permutations([0, 1, 2, 3]).find((perm) =>
    verifyTsp(SQUARE, budget, perm)
  );
  expect(witness).toBeDefined();
});

test("permutations returns every ordering exactly once", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const input = Array.from({ length: n }, (_, i) => i);
    const perms = permutations(input);
    const factorial = input.reduce((acc, _, i) => acc * (i + 1), 1);
    expect(perms).toHaveLength(factorial);
    expect(new Set(perms.map((p) => p.join(",")))).toHaveProperty("size", factorial);
  }
});
