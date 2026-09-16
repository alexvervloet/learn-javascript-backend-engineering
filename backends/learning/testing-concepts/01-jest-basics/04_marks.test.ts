/**
 * Skipping, Conditional Skips & Expected Failures
 * ===============================================
 * Jest expresses skip / conditional-skip / expected-failure intents with test
 * modifiers and plain JS conditions:
 *
 *   skip                 → test.skip(...)
 *   conditional skip     → (cond ? test.skip : test)(...)   — pick the modifier
 *   expected failure     → test.failing(...)   (Jest 29.6+: passes iff the body fails)
 *   xfail strict    → test.failing is already strict (an unexpected PASS fails)
 *   custom marks    → filter by name with `jest -t "slow"` or group with describe
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/01-jest-basics/04_marks
 *   npm test -- .../04_marks -t "slow"        # only tests whose name matches "slow"
 *   npm test -- .../04_marks -t "^(?!.*slow)" # everything except "slow"
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";

// ---------------------------------------------------------------------------
// 1. skip — unconditionally skip (placeholder for unimplemented work)
// ---------------------------------------------------------------------------

test.skip("future feature — not implemented yet (issue #88)", () => {
  throw new Error("This body never runs");
});

// ---------------------------------------------------------------------------
// 2. Conditional skip — choose the modifier from a runtime condition
// ---------------------------------------------------------------------------

const onWindows = process.platform === "win32";
const testOnPosix = onWindows ? test.skip : test;

testOnPosix("uses POSIX path conventions", () => {
  expect("/usr/local/bin/node".startsWith("/")).toBe(true);
});

const nodeMajor = Number(process.versions.node.split(".")[0]);
const testIfModernNode = nodeMajor >= 18 ? test : test.skip;

testIfModernNode("uses a feature that needs Node 18+", () => {
  expect(typeof structuredClone).toBe("function");
});

// ---------------------------------------------------------------------------
// 3. test.failing — document a known failure (an expected-failure test)
//    The test is reported as passing while the body keeps failing. The moment
//    the underlying bug is fixed, test.failing FAILS (an unexpected pass), which
//    reminds you to remove the marker — the same safety as xfail(strict=True).
// ---------------------------------------------------------------------------

test.failing("known float precision edge case", () => {
  // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754, not exactly 0.3, so an exact
  // `toBe(0.3)` fails. (Real code should use toBeCloseTo — see 01_basics.)
  expect(0.1 + 0.2).toBe(0.3);
});

// ---------------------------------------------------------------------------
// 4. "Custom marks" — Jest filters by test name, not tags
//    Put a keyword in the name and select it with `jest -t`.
// ---------------------------------------------------------------------------

test("[slow] cpu-intensive operation", () => {
  let total = 0;
  for (let i = 0; i < 1_000_000; i += 1) total += i * i;
  expect(total).toBeGreaterThan(0);
});

test("fast calculation", () => {
  expect(2 ** 10).toBe(1024);
});

// ---------------------------------------------------------------------------
// 5. Shared side-effect setup — the "usefixtures" equivalent
//    A beforeEach runs for every test in scope without being referenced.
// ---------------------------------------------------------------------------

describe("logged tests", () => {
  const callLog: string[] = [];

  // The arrow bodies are braced so the hooks return void rather than the
  // number push() hands back, which Jest would read as a return value.
  beforeEach(() => {
    callLog.push("start");
  });
  afterEach(() => {
    callLog.push("end");
  });

  test("first logged test", () => {
    expect(true).toBe(true);
  });

  test("second logged test", () => {
    expect(true).toBe(true);
  });

  test("the beforeEach hook ran for every test", () => {
    // 2 prior tests × (start + end) = 4, plus this test's own "start" = 5.
    expect(callLog.filter((e) => e === "start").length).toBeGreaterThanOrEqual(3);
  });
});
