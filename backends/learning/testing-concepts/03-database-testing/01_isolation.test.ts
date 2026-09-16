/**
 * Test Isolation
 * ==============
 * Each test must start from a clean database so tests can run in any order.
 * The naive approach (DELETE / recreate schema between tests) is slow; the
 * standard approach is **transaction rollback**.
 *
 * With better-sqlite3 we open ONE database for the file, then wrap each test in
 * a SAVEPOINT and roll back to it afterwards:
 *
 *   beforeEach → SAVEPOINT test     (a nested transaction marker)
 *   afterEach  → ROLLBACK TO test   (undoes every write the test made)
 *
 * This connection-level rollback is fast (no DDL), automatic, and
 * order-independent. The same pattern applies to Postgres via your client's
 * transaction/savepoint API.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/03-database-testing/01_isolation
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";

import { createDb } from "./db.js";
import * as repository from "./repository.js";

const db = createDb();

// Braced bodies so the hooks return void rather than the Database handle
// that exec() returns for chaining, which Jest would treat as a return value.
beforeEach(() => {
  db.exec("SAVEPOINT test");
});
afterEach(() => {
  db.exec("ROLLBACK TO test");
});

// ── Basic CRUD ────────────────────────────────────────────────────────────

describe("createUser", () => {
  test("creates a user with the correct fields", () => {
    const user = repository.createUser(db, "alice", "alice@example.com");
    expect(user.id).toBeDefined();
    expect(user.username).toBe("alice");
    expect(user.email).toBe("alice@example.com");
  });

  test("two users get different ids", () => {
    const alice = repository.createUser(db, "alice", "alice@example.com");
    const bob = repository.createUser(db, "bob", "bob@example.com");
    expect(alice.id).not.toBe(bob.id);
  });
});

describe("getUser", () => {
  test("get by id returns the user", () => {
    const created = repository.createUser(db, "alice", "alice@example.com");
    // getUserById is deliberately nullable — the next test asserts it returns
    // null for an unknown id — so reaching for a field needs ?.
    expect(repository.getUserById(db, created.id)?.username).toBe("alice");
  });

  test("get by id returns null for an unknown id", () => {
    expect(repository.getUserById(db, 99999)).toBeNull();
  });

  test("get by email returns the user", () => {
    repository.createUser(db, "bob", "bob@example.com");
    expect(repository.getUserByEmail(db, "bob@example.com")?.username).toBe("bob");
  });

  test("get by email returns null for an unknown address", () => {
    expect(repository.getUserByEmail(db, "ghost@example.com")).toBeNull();
  });
});

describe("deleteUser", () => {
  test("a deleted user is not found", () => {
    const user = repository.createUser(db, "carol", "carol@example.com");
    repository.deleteUser(db, user);
    expect(repository.getUserById(db, user.id)).toBeNull();
  });
});

// ── Isolation proof — these run in sequence; data must not bleed over ───────

describe("isolation", () => {
  test("first test creates a user", () => {
    repository.createUser(db, "isolation_user", "iso@example.com");
    expect(repository.listUsers(db)).toHaveLength(1);
  });

  test("second test sees an empty database", () => {
    // If rollback worked, isolation_user is gone.
    expect(repository.listUsers(db)).toHaveLength(0);
  });

  test("write and verify within the same test", () => {
    repository.createUser(db, "alice", "alice@example.com");
    repository.createUser(db, "bob", "bob@example.com");
    const usernames = repository.listUsers(db).map((u) => u.username);
    expect(usernames).toEqual(["alice", "bob"]);
  });
});
