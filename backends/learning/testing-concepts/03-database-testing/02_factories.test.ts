/**
 * Factory Helpers
 * ===============
 * A factory returns a *callable* that builds a row, passing only the fields a
 * scenario cares about; everything else gets a sensible default. This beats a
 * fixed fixture object: you can create many rows per test and override just what
 * matters, keeping the test's intent obvious.
 *
 *   const makeUser = makeUserFactory(db);
 *   const alice = makeUser({ username: "alice" });
 *   const post  = makePost(alice, { published: true });
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/03-database-testing/02_factories
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";

import { createDb } from "./db.js";
import { makeUserFactory, makePostFactory } from "./factories.js";
import * as repository from "./repository.js";

const db = createDb();
const makeUser = makeUserFactory(db);
const makePost = makePostFactory(db);

// Braced bodies so the hooks return void rather than the Database handle
// that exec() returns for chaining, which Jest would treat as a return value.
beforeEach(() => {
  db.exec("SAVEPOINT test");
});
afterEach(() => {
  db.exec("ROLLBACK TO test");
});

// ── Basic factory usage ─────────────────────────────────────────────────────

describe("user factory", () => {
  test("default username", () => {
    const user = makeUser();
    expect(user.username).toBe("alice");
    expect(user.email).toBe("alice@example.com");
  });

  test("custom username", () => {
    expect(makeUser({ username: "bob" }).email).toBe("bob@example.com");
  });

  test("custom email override", () => {
    expect(makeUser({ username: "carol", email: "work@corp.com" }).email).toBe("work@corp.com");
  });

  test("multiple users have different ids", () => {
    expect(makeUser({ username: "alice" }).id).not.toBe(makeUser({ username: "bob" }).id);
  });
});

// ── Multi-object scenarios ──────────────────────────────────────────────────

describe("post factory", () => {
  test("post is linked to its user", () => {
    const user = makeUser();
    expect(makePost(user).user_id).toBe(user.id);
  });

  test("default post is unpublished", () => {
    expect(makePost(makeUser()).published).toBe(0);
  });

  test("published flag override", () => {
    expect(makePost(makeUser(), { published: true }).published).toBe(1);
  });

  test("title override", () => {
    expect(makePost(makeUser(), { title: "My Custom Title" }).title).toBe("My Custom Title");
  });
});

// ── Repository queries against factory-built data ───────────────────────────

describe("getPublishedPosts", () => {
  test("returns only published posts", () => {
    const author = makeUser();
    makePost(author, { title: "Draft Post", published: false });
    makePost(author, { title: "Published Post", published: true });

    const titles = repository.getPublishedPosts(db).map((p) => p.title);
    expect(titles).toContain("Published Post");
    expect(titles).not.toContain("Draft Post");
  });

  test("counts multiple published posts", () => {
    const author = makeUser();
    makePost(author, { title: "A", published: true });
    makePost(author, { title: "B", published: true });
    makePost(author, { title: "C", published: false });
    expect(repository.getPublishedPosts(db)).toHaveLength(2);
  });
});

describe("getPostsByUser", () => {
  test("returns only that user's posts", () => {
    const alice = makeUser({ username: "alice" });
    const bob = makeUser({ username: "bob" });
    makePost(alice, { title: "Alice's post" });
    makePost(bob, { title: "Bob's post" });

    const alicePosts = repository.getPostsByUser(db, alice);
    expect(alicePosts).toHaveLength(1);
    expect(alicePosts[0].title).toBe("Alice's post");
  });

  test("returns an empty array for a user with no posts", () => {
    expect(repository.getPostsByUser(db, makeUser())).toEqual([]);
  });
});

// ── Cascade delete — deleting a user removes their posts (ON DELETE CASCADE) ─

describe("cascade delete", () => {
  test("deleting a user removes their posts", () => {
    const user = makeUser();
    const post = makePost(user, { title: "Will be deleted", published: true });

    repository.deleteUser(db, user);

    const remaining = repository.getPublishedPosts(db);
    expect(remaining.every((p) => p.id !== post.id)).toBe(true);
  });
});
