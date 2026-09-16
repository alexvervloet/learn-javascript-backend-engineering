/**
 * Async data access layer.
 *
 * Every operation is awaited — the interface mirrors the sync repository in
 * 03-database-testing/ so the two can be compared directly.
 */

import type { AsyncDb, UserRow, PostRow } from "./async_db.js";

// Returns UserRow, not UserRow | null: the row was just inserted on this
// connection, so reading it back cannot miss. Stating it here keeps the check
// in one place rather than at every call site.
async function createUser(db: AsyncDb, username: string, email: string): Promise<UserRow> {
  const info = await db.run(
    "INSERT INTO users (username, email) VALUES (?, ?)",
    username,
    email
  );
  const user = await getUserById(db, Number(info.lastInsertRowid));
  if (user === null) {
    throw new Error("Inserted user could not be read back");
  }
  return user;
}

async function getUserById(db: AsyncDb, id: number): Promise<UserRow | null> {
  return db.get<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

async function getUserByEmail(db: AsyncDb, email: string): Promise<UserRow | null> {
  return db.get<UserRow>("SELECT * FROM users WHERE email = ?", email);
}

async function listUsers(db: AsyncDb): Promise<UserRow[]> {
  return db.all<UserRow>("SELECT * FROM users ORDER BY id");
}

async function createPost(
  db: AsyncDb,
  user: UserRow,
  title: string,
  body: string,
  published = false
): Promise<PostRow> {
  const info = await db.run(
    "INSERT INTO posts (user_id, title, body, published) VALUES (?, ?, ?, ?)",
    user.id,
    title,
    body,
    published ? 1 : 0
  );
  const post = await db.get<PostRow>(
    "SELECT * FROM posts WHERE id = ?",
    Number(info.lastInsertRowid)
  );
  if (post === null) {
    throw new Error("Inserted post could not be read back");
  }
  return post;
}

async function getPublishedPosts(db: AsyncDb): Promise<PostRow[]> {
  return db.all<PostRow>("SELECT * FROM posts WHERE published = 1 ORDER BY id");
}

async function getPostsByUser(db: AsyncDb, user: UserRow): Promise<PostRow[]> {
  return db.all<PostRow>("SELECT * FROM posts WHERE user_id = ? ORDER BY id", user.id);
}

export {
  createUser,
  getUserById,
  getUserByEmail,
  listUsers,
  createPost,
  getPublishedPosts,
  getPostsByUser,
};
