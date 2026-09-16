/**
 * Data access layer — the code under test.
 *
 * Keeping queries in repository functions (rather than inline in routes) makes
 * them easy to unit-test: pass in a db handle and assert on the result. With
 * better-sqlite3 every call is synchronous — no await.
 *
 * A driver cannot know what a SQL string returns, so `.get()` and `.all()` are
 * typed as unknown by default. The type argument on each prepare() is where the
 * shape gets declared — and it is a claim about the SQL, not a guarantee, so it
 * is worth keeping the query and its row type next to each other.
 */

import type { DatabaseType, UserRow, PostRow } from "./db.js";

// ── Users ─────────────────────────────────────────────────────────────────

// Returns UserRow, not UserRow | null. The row was just inserted on this same
// connection, so reading it back cannot miss. Saying so here keeps the null
// check in one place instead of at every call site in the tests.
function createUser(db: DatabaseType, username: string, email: string): UserRow {
  const info = db
    .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
    .run(username, email);
  const user = getUserById(db, Number(info.lastInsertRowid));
  if (user === null) {
    throw new Error("Inserted user could not be read back");
  }
  return user;
}

function getUserById(db: DatabaseType, id: number): UserRow | null {
  return db.prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?").get(id) ?? null;
}

function getUserByEmail(db: DatabaseType, email: string): UserRow | null {
  return (
    db.prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?").get(email) ?? null
  );
}

function listUsers(db: DatabaseType): UserRow[] {
  return db.prepare<[], UserRow>("SELECT * FROM users ORDER BY id").all();
}

function deleteUser(db: DatabaseType, user: UserRow): void {
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
}

// ── Posts ─────────────────────────────────────────────────────────────────

function createPost(
  db: DatabaseType,
  user: UserRow,
  title: string,
  body: string,
  published = false
): PostRow {
  const info = db
    .prepare("INSERT INTO posts (user_id, title, body, published) VALUES (?, ?, ?, ?)")
    .run(user.id, title, body, published ? 1 : 0);
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(info.lastInsertRowid));
  if (post === undefined) {
    throw new Error("Inserted post could not be read back");
  }
  return post;
}

function getPublishedPosts(db: DatabaseType): PostRow[] {
  return db
    .prepare<[], PostRow>("SELECT * FROM posts WHERE published = 1 ORDER BY id")
    .all();
}

function getPostsByUser(db: DatabaseType, user: UserRow): PostRow[] {
  return db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE user_id = ? ORDER BY id")
    .all(user.id);
}

export {
  createUser,
  getUserById,
  getUserByEmail,
  listUsers,
  deleteUser,
  createPost,
  getPublishedPosts,
  getPostsByUser,
};
