/**
 * Schema + connection for section 03.
 *
 * Uses better-sqlite3 — the popular *synchronous* SQLite driver for Node. An
 * in-memory database (":memory:") needs no file and no cleanup, so the whole
 * section runs standalone with no Docker.
 *
 * The row interfaces live here next to the CREATE TABLE that produces them.
 * SQLite has no boolean type, so `published` is the 0 or 1 actually stored,
 * not a boolean — writing that down is more useful than pretending otherwise.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

interface UserRow {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

interface PostRow {
  id: number;
  title: string;
  body: string;
  published: 0 | 1;
  user_id: number;
  created_at: string;
}

function createDb(): DatabaseType {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON"); // SQLite doesn't enforce FKs unless asked
  db.exec(`
    CREATE TABLE users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      email      TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      published  INTEGER NOT NULL DEFAULT 0,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export { createDb };
export type { DatabaseType, UserRow, PostRow };
