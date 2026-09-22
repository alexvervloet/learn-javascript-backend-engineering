// Config guard tests.
//
// These import config.ts on its own rather than going through setup.ts: the
// guard runs at getSettings() time and the point is to watch it fire, so the
// test needs a clean process.env rather than the one the app suites share.

import { test, expect, beforeEach, afterEach } from "@jest/globals";

import { getSettings } from "../app/config.js";

const PLACEHOLDER = "change-me-in-production";
const REAL_SECRET = "a".repeat(32);

// getSettings reads process.env on every call, so each test sets up the exact
// environment it wants and the original is put back afterwards.
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
  saved = { ...process.env };
  delete process.env.SECRET_KEY;
  delete process.env.ENVIRONMENT;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = saved;
});

test("development boots on the placeholder secret", () => {
  // The whole reason the placeholder exists: a fresh clone runs without setup.
  expect(getSettings().secretKey).toBe(PLACEHOLDER);
});

test("production rejects the placeholder secret", () => {
  process.env.ENVIRONMENT = "production";
  expect(() => getSettings()).toThrow(/still the example placeholder/);
});

test("NODE_ENV=production alone is enough to trigger the guard", () => {
  // A deployment that never sets ENVIRONMENT still gets caught, because
  // NODE_ENV=production is the convention every Node host already sets.
  process.env.NODE_ENV = "production";
  expect(() => getSettings()).toThrow(/still the example placeholder/);
});

test("production rejects a secret that is too short", () => {
  process.env.ENVIRONMENT = "production";
  process.env.SECRET_KEY = "short-but-not-the-placeholder";
  expect(() => getSettings()).toThrow(/at least 32 characters/);
});

test("production accepts a long non-placeholder secret", () => {
  process.env.ENVIRONMENT = "production";
  process.env.SECRET_KEY = REAL_SECRET;
  expect(getSettings().secretKey).toBe(REAL_SECRET);
});

test("a short secret is fine outside production", () => {
  // Local development should not have to generate 32 random bytes to run a demo.
  process.env.SECRET_KEY = "dev";
  expect(getSettings().secretKey).toBe("dev");
});
