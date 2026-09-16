/**
 * Jest Basics
 * ===========
 * Jest discovers tests by scanning for files matching `*.test.ts` (configured in
 * the root jest.config.js), then runs each `test(...)` / `it(...)` block.
 *
 * Assertions go through the `expect(...)` API with matchers (`.toBe`, `.toEqual`,
 * `.toThrow`, …). Matchers produce the rich diff output on failure.
 *
 * Discovery rules (this repo): files named `*.test.ts`. Group with `describe`.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/01-jest-basics/01_basics
 */

import { describe, test, expect } from "@jest/globals";

// ---------------------------------------------------------------------------
// Code under test
// ---------------------------------------------------------------------------

function add(a: number, b: number): number {
  return a + b;
}

function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Cannot divide by zero");
  return a / b;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/ /g, "-");
}

// ---------------------------------------------------------------------------
// 1. Basic tests
// ---------------------------------------------------------------------------

test("add two positives", () => {
  expect(add(2, 3)).toBe(5);
});

test("add negative numbers", () => {
  expect(add(-1, -2)).toBe(-3);
});

test("add with zero", () => {
  expect(add(0, 99)).toBe(99);
});

test("slugify lowercases", () => {
  expect(slugify("Hello World")).toBe("hello-world");
});

test("slugify strips whitespace", () => {
  expect(slugify("  spaces  ")).toBe("spaces");
});

// ---------------------------------------------------------------------------
// 2. Value vs structural equality — toBe vs toEqual
//    toBe is Object.is (reference/identity); toEqual does a deep compare.
// ---------------------------------------------------------------------------

test("list contains expected items", () => {
  const items = ["apple", "banana", "cherry"];
  expect(items).toContain("banana");
  expect(items).toHaveLength(3);
});

test("deep equality for objects/arrays uses toEqual", () => {
  const user = { id: 1, name: "Alice", role: "admin" };
  expect(user).toEqual({ id: 1, name: "Alice", role: "admin" });
  expect(user).not.toHaveProperty("email");
});

// ---------------------------------------------------------------------------
// 3. Testing exceptions with toThrow
//    The code under test must be wrapped in a function so Jest can catch it.
// ---------------------------------------------------------------------------

test("divide by zero throws", () => {
  expect(() => divide(10, 0)).toThrow();
});

test("error message matches (string or regex)", () => {
  expect(() => divide(10, 0)).toThrow("Cannot divide by zero");
  expect(() => divide(10, 0)).toThrow(/cannot divide/i);
});

// ---------------------------------------------------------------------------
// 4. Grouping with describe
// ---------------------------------------------------------------------------

describe("divide", () => {
  test("even division", () => {
    expect(divide(10, 2)).toBe(5);
  });

  test("negative divisor", () => {
    expect(divide(10, -2)).toBe(-5);
  });

  test("fractional result", () => {
    expect(divide(1, 3)).toBeCloseTo(0.333, 3);
  });
});

// ---------------------------------------------------------------------------
// 5. toBeCloseTo for floating-point comparisons
//    0.1 + 0.2 !== 0.3 in IEEE 754 — toBeCloseTo handles the tolerance.
// ---------------------------------------------------------------------------

test("float addition", () => {
  expect(0.1 + 0.2).toBeCloseTo(0.3);
});

test("closeTo with explicit precision (digits after the decimal)", () => {
  expect(1.001).toBeCloseTo(1.0, 2);
});

test("array of floats compared element-wise", () => {
  const results = [divide(1, 3), divide(2, 3)];
  expect(results[0]).toBeCloseTo(0.333, 2);
  expect(results[1]).toBeCloseTo(0.667, 2);
});
