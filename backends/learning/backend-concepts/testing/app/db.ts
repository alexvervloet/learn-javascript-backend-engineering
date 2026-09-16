// In-memory SQLite (better-sqlite3) + schema. In-memory keeps the suite
// self-contained (no Postgres). Tests isolate themselves with SAVEPOINT /
// ROLLBACK in beforeEach/afterEach — a transaction-rollback strategy on one
// shared connection.

import Database from "better-sqlite3";

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email    TEXT NOT NULL UNIQUE
  );
  CREATE TABLE posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    published  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// The two row shapes this schema produces. better-sqlite3 cannot know what a
// SQL string returns, so each prepare() in main.ts is handed one of these.
// SQLite has no boolean, so `published` is the 0 or 1 actually stored.
interface UserRow {
  id: number;
  username: string;
  email: string;
}

interface PostRow {
  id: number;
  user_id: number;
  title: string;
  body: string;
  published: 0 | 1;
  created_at: string;
}

export { db };
export type { UserRow, PostRow };
