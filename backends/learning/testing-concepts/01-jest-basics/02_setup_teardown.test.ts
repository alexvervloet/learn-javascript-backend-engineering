/**
 * Setup / Teardown & "Fixtures"
 * =============================
 * Jest builds shared setup out of a few hooks plus plain helper functions:
 *
 *   - beforeEach / afterEach  → per-test setup + teardown
 *   - beforeAll / afterAll    → once per file/describe block
 *   - factory functions       → reusable "make me one of these" helpers
 *   - describe blocks         → scope setup to a group of tests
 *
 * Where a hook lives controls how often it runs:
 *   beforeEach (in a file)         → before every test
 *   beforeAll (in a describe)      → once for that group
 *   beforeAll (top level)          → once for the whole file
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/01-jest-basics/02_setup_teardown
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";

// ---------------------------------------------------------------------------
// 1. Factory helper — the JS replacement for a value fixture
//    A plain function returning a fresh object each call. No magic injection.
// ---------------------------------------------------------------------------

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Partial<User> is what makes the overrides argument safe: any subset of
// User's fields is allowed, but an unknown key or a wrong type is not.
function makeUser(overrides: Partial<User> = {}): User {
  return { id: 1, name: "Alice", email: "alice@example.com", role: "user", ...overrides };
}

test("user has a name", () => {
  expect(makeUser().name).toBe("Alice");
});

test("user default role", () => {
  expect(makeUser().role).toBe("user");
});

test("mutation does not bleed — each call is a fresh object", () => {
  const user = makeUser();
  user.role = "admin";
  expect(user.role).toBe("admin");
  // A separate makeUser() call is unaffected:
  expect(makeUser().role).toBe("user");
});

// ---------------------------------------------------------------------------
// 2. beforeEach / afterEach — setup before each test, teardown after
//    afterEach runs even if the test fails, so cleanup always happens.
// ---------------------------------------------------------------------------

describe("tracked list (beforeEach/afterEach)", () => {
  // Declared here and filled in by beforeEach, so the annotation has to be
  // written out: there is no initialiser for the compiler to infer from.
  let items: string[];

  beforeEach(() => {
    items = []; // setup: fresh list per test
  });

  afterEach(() => {
    items.length = 0; // teardown
  });

  test("append items", () => {
    items.push("a", "b");
    expect(items).toHaveLength(2);
  });

  test("list starts empty again", () => {
    expect(items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. beforeAll — shared state across a describe block (module/class scope)
// ---------------------------------------------------------------------------

describe("shared counter (beforeAll)", () => {
  let state: { count: number };

  beforeAll(() => {
    state = { count: 0 }; // created ONCE for the whole block
  });

  test("first use", () => {
    state.count += 1;
    expect(state.count).toBe(1);
  });

  test("second use sees the carried-over value", () => {
    state.count += 1;
    expect(state.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Composing factories — build on top of a base factory
// ---------------------------------------------------------------------------

interface Admin extends User {
  permissions: string[];
}

function makeAdmin(overrides: Partial<Admin> = {}): Admin {
  return {
    ...makeUser(),
    role: "admin",
    permissions: ["read", "write", "delete"],
    ...overrides,
  };
}

test("admin has the correct role", () => {
  expect(makeAdmin().role).toBe("admin");
});

test("admin has permissions and inherits base fields", () => {
  const admin = makeAdmin();
  expect(admin.permissions).toContain("delete");
  expect(admin.email).toBe("alice@example.com"); // inherited from makeUser
});

// ---------------------------------------------------------------------------
// 5. test.each — data-driven cases (one test body, many input rows)
// ---------------------------------------------------------------------------

test.each(["alice@example.com", "BOB@EXAMPLE.COM", "carol+tag@domain.co"])(
  "%s contains an @ sign",
  (email) => {
    expect(email).toContain("@");
  }
);
