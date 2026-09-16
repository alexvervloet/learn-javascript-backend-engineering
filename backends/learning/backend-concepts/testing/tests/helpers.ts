// Shared test setup: savepoint-based isolation + factory helpers.
//
// installIsolation() wraps each test in a SAVEPOINT and rolls it back afterwards,
// so every test starts from a clean database. Factories return rows with
// sensible, overridable defaults for building test data.

import { beforeEach, afterEach } from "@jest/globals";

import { db } from "../app/db.js";
import type { PostRow, UserRow } from "../app/db.js";

interface UserOverrides {
  username?: string;
  email?: string;
}

interface PostOverrides {
  title?: string;
  body?: string;
  published?: boolean;
}

function installIsolation(): void {
  // Braced bodies so the hooks return void rather than the Database handle
  // exec() returns for chaining, which Jest would read as a return value.
  beforeEach(() => {
    db.exec("SAVEPOINT test");
  });
  afterEach(() => {
    db.exec("ROLLBACK TO test");
  });
}

// Returns UserRow, not UserRow | null: the row was just inserted on this
// connection, so reading it back cannot miss.
function makeUser({ username = "alice", email }: UserOverrides = {}): UserRow {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
    .run(username, email ?? `${username}@example.com`);
  const user = db
    .prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?")
    .get(Number(lastInsertRowid));
  if (!user) throw new Error("Inserted user could not be read back");
  return user;
}

function makePost(
  user: UserRow,
  { title = "Test Post", body = "Body text.", published = true }: PostOverrides = {}
): PostRow {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO posts (user_id, title, body, published) VALUES (?, ?, ?, ?)")
    .run(user.id, title, body, published ? 1 : 0);
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(lastInsertRowid));
  if (!post) throw new Error("Inserted post could not be read back");
  return post;
}

export { db, installIsolation, makeUser, makePost };
