/**
 * Async schema/connection for section 04.
 *
 * better-sqlite3 itself is synchronous, but real backends usually use an *async*
 * driver (pg, mysql2, libsql). To practise async test patterns we wrap the sync
 * driver in a thin async interface: `run`/`get`/`all`/`exec` return promises.
 * The test code then looks exactly like it would against a real async database —
 * the lesson is the awaiting and async fixtures, not the driver internals.
 *
 * AsyncDb below is the interface that wrapper presents. `get` and `all` are
 * generic over the row type, so a caller says what a query returns at the call
 * site — the same job the type argument on prepare() does in section 03.
 */

import Database from "better-sqlite3";
import type { RunResult } from "better-sqlite3";

type SqlParam = string | number | bigint | Buffer | null;

interface UserRow {
  id: number;
  username: string;
  email: string;
}

interface PostRow {
  id: number;
  title: string;
  body: string;
  published: 0 | 1;
  user_id: number;
}

interface AsyncDb {
  run(sql: string, ...params: SqlParam[]): Promise<RunResult>;
  get<T>(sql: string, ...params: SqlParam[]): Promise<T | null>;
  all<T>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  exec(sql: string): Promise<unknown>;
}

function createAsyncDb(): AsyncDb {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email    TEXT NOT NULL UNIQUE
    );
    CREATE TABLE posts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT NOT NULL,
      body      TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Promise-returning wrappers — the async surface the repository/tests use.
  return {
    run: async (sql, ...params) => db.prepare(sql).run(...params),
    get: async <T,>(sql: string, ...params: SqlParam[]) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T,>(sql: string, ...params: SqlParam[]) =>
      db.prepare(sql).all(...params) as T[],
    exec: async (sql) => db.exec(sql),
  };
}

export { createAsyncDb };
export type { AsyncDb, SqlParam, UserRow, PostRow };
