/**
 * Async Database Testing
 * ======================
 * The async repository uses an awaited db interface. Testing it needs async
 * fixtures (async beforeEach/afterEach) and async test bodies.
 *
 * The isolation strategy is identical to 03-database-testing/: wrap each test in
 * a SAVEPOINT and roll back afterwards — only now the calls are awaited. Compare
 * this file with 03-database-testing/02_factories.test.js to see how the sync and
 * async patterns mirror each other.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/04-async-testing/02_async_db
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";

import { createAsyncDb } from "./async_db.js";
import * as repository from "./async_repository.js";
import type { UserRow } from "./async_db.js";

const db = createAsyncDb();

// Async factories bound to the db handle.
interface UserOverrides {
  username?: string;
  email?: string;
}

interface PostOverrides {
  title?: string;
  body?: string;
  published?: boolean;
}

const makeUser = ({ username = "alice", email }: UserOverrides = {}) =>
  repository.createUser(db, username, email ?? `${username}@example.com`);
const makePost = (
  user: UserRow,
  { title = "Test Post", body = "Body.", published = false }: PostOverrides = {}
) => repository.createPost(db, user, title, body, published);

// Braced bodies so the hooks resolve to void rather than whatever exec()
// resolves to, which Jest would treat as a returned value.
beforeEach(async () => {
  await db.exec("SAVEPOINT test");
});
afterEach(async () => {
  await db.exec("ROLLBACK TO test");
});

// ── CRUD ────────────────────────────────────────────────────────────────────

describe("async createUser", () => {
  test("creates a user with the correct fields", async () => {
    const user = await repository.createUser(db, "alice", "alice@example.com");
    expect(user.id).toBeDefined();
    expect(user.username).toBe("alice");
    expect(user.email).toBe("alice@example.com");
  });

  test("two users get different ids", async () => {
    const alice = await repository.createUser(db, "alice", "alice@example.com");
    const bob = await repository.createUser(db, "bob", "bob@example.com");
    expect(alice.id).not.toBe(bob.id);
  });
});

describe("async getUser", () => {
  test("get by id returns the user", async () => {
    const created = await repository.createUser(db, "alice", "alice@example.com");
    // getUserById is deliberately nullable — the next test asserts it returns
    // null for a missing id — so reaching for a field needs ?.
    expect((await repository.getUserById(db, created.id))?.username).toBe("alice");
  });

  test("get by id returns null for a missing id", async () => {
    expect(await repository.getUserById(db, 99999)).toBeNull();
  });

  test("get by email", async () => {
    await repository.createUser(db, "bob", "bob@example.com");
    expect((await repository.getUserByEmail(db, "bob@example.com"))?.username).toBe("bob");
  });
});

// ── Isolation — same proof as the sync version ──────────────────────────────

describe("async isolation", () => {
  test("first test creates data", async () => {
    await repository.createUser(db, "isolation_user", "iso@example.com");
    expect(await repository.listUsers(db)).toHaveLength(1);
  });

  test("second test starts clean", async () => {
    expect(await repository.listUsers(db)).toHaveLength(0);
  });
});

// ── Query tests with factory-built data ─────────────────────────────────────

describe("async post queries", () => {
  test("only published posts returned", async () => {
    const author = await makeUser();
    await makePost(author, { title: "Draft", published: false });
    await makePost(author, { title: "Published", published: true });

    const titles = (await repository.getPublishedPosts(db)).map((p) => p.title);
    expect(titles).toContain("Published");
    expect(titles).not.toContain("Draft");
  });

  test("getPostsByUser filters correctly", async () => {
    const alice = await makeUser({ username: "alice" });
    const bob = await makeUser({ username: "bob" });
    await makePost(alice, { title: "Alice's post" });
    await makePost(bob, { title: "Bob's post" });

    const alicePosts = await repository.getPostsByUser(db, alice);
    expect(alicePosts).toHaveLength(1);
    expect(alicePosts[0].title).toBe("Alice's post");
  });

  test("user with no posts returns an empty array", async () => {
    expect(await repository.getPostsByUser(db, await makeUser())).toEqual([]);
  });

  test("multiple posts for the same user", async () => {
    const author = await makeUser();
    await makePost(author, { title: "Post 1", published: true });
    await makePost(author, { title: "Post 2", published: true });
    await makePost(author, { title: "Post 3", published: false });

    expect(await repository.getPublishedPosts(db)).toHaveLength(2);
    expect(await repository.getPostsByUser(db, author)).toHaveLength(3);
  });
});
