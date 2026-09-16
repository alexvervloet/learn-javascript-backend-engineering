// SQLite connection + schema for the pagination demo. File-backed (articles.db)
// so the seed persists between `seed.ts` and `main.ts` runs.

import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const db = new Database(path.join(here, "articles.db"));
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    author       TEXT NOT NULL,
    published_at TEXT NOT NULL,
    view_count   INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// One article row. better-sqlite3 cannot know what a SQL string returns, so the
// shape is declared here next to the CREATE TABLE that produces it.
interface Article {
  id: number;
  title: string;
  body: string;
  author: string;
  published_at: string;
  view_count: number;
}

export { db };
export type { Article };
