/**
 * PostgreSQL Index Types
 * ======================
 * An index is a separate structure consulted instead of scanning every row —
 * but only if the index type supports the operator used.
 *
 *   B-tree — default, sorted. =, <, >, BETWEEN, IN, ORDER BY, LIKE 'prefix%'.
 *   Hash   — equality only (=). Rarely beats B-tree.
 *   GIN    — inverted index for composite values: arrays, JSONB, tsvector
 *            (@>, &&, @@). Slow writes, fast reads.
 *   GiST   — spatial/range strategies: ranges, geometry, KNN (&&, @>, <->).
 *
 * Pure SQL — only the driver glue is Node-specific.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 01_index_types.ts
 */

import * as db from "./db.js";

const SETUP = `
DROP TABLE IF EXISTS idx_events;
DROP TABLE IF EXISTS idx_articles;
DROP TABLE IF EXISTS idx_sessions;
DROP TABLE IF EXISTS idx_users;

CREATE TABLE idx_users (
  user_id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL
);
CREATE TABLE idx_sessions (
  session_id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES idx_users,
  token TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE idx_articles (
  article_id SERIAL PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'
);
CREATE TABLE idx_events (
  event_id SERIAL PRIMARY KEY, name TEXT NOT NULL, period DATERANGE NOT NULL
);
`;

const CREATE_INDEXES = `
-- B-tree: equality + range + ORDER BY.
CREATE INDEX idx_btree_username ON idx_users USING BTREE (username);
-- Hash: equality-only (long tokens you never range over).
CREATE INDEX idx_hash_token ON idx_sessions USING HASH (token);
-- GIN on an array: @> (contains), && (overlap).
CREATE INDEX idx_gin_tags ON idx_articles USING GIN (tags);
-- GIN on a computed tsvector: @@ (full-text match).
CREATE INDEX idx_gin_fts ON idx_articles USING GIN (to_tsvector('english', title || ' ' || body));
-- GiST on a daterange: && (overlap), @> (contains date).
CREATE INDEX idx_gist_period ON idx_events USING GIST (period);
`;

const SEED = `
INSERT INTO idx_users (email, username) VALUES
  ('alice@example.com','alice'),('bob@example.com','bob'),('carol@example.com','carol');
INSERT INTO idx_sessions (user_id, token) VALUES
  (1,'tok_a1b2c3d4e5f6'),(2,'tok_x9y8z7w6v5u4'),(3,'tok_p1q2r3s4t5u6');
INSERT INTO idx_articles (title, body, tags) VALUES
  ('Intro to PostgreSQL','PostgreSQL is a powerful open-source relational database.',ARRAY['postgresql','database','sql']),
  ('JavaScript and Databases','Connecting Node to PostgreSQL using pg is straightforward.',ARRAY['javascript','postgresql','pg']),
  ('Full-Text Search in Postgres','GIN indexes accelerate tsvector queries for full-text search.',ARRAY['postgresql','search','gin']),
  ('Getting Started with Redis','Redis is an in-memory key-value store often used for caching.',ARRAY['redis','caching','nosql']);
INSERT INTO idx_events (name, period) VALUES
  ('JavaScript Conference','[2026-06-01,2026-06-03]'),('Database Summit','[2026-06-10,2026-06-12]'),
  ('Cloud Expo','[2026-07-05,2026-07-07]'),('DevOps Days','[2026-06-20,2026-06-21]'),
  ('Security Workshop','[2026-05-28,2026-05-29]');
`;

async function main() {
  await db.query(SETUP);
  await db.query(CREATE_INDEXES);
  await db.query(SEED);

  console.log("=".repeat(60));
  console.log("ALL INDEXES ON OUR TABLES");
  console.log("=".repeat(60));
  await db.printTable(
    "SELECT indexname, tablename, indexdef FROM pg_indexes WHERE tablename LIKE 'idx_%' ORDER BY tablename, indexname",
    ["index_name", "table", "definition"]
  );

  console.log("=".repeat(60));
  console.log("B-TREE — equality, ranges, ORDER BY");
  console.log("=".repeat(60));
  await db.printTable("SELECT user_id, email, username FROM idx_users WHERE email = $1", ["user_id", "email", "username"], ["alice@example.com"]);
  await db.printTable("SELECT user_id, email, username FROM idx_users WHERE username >= 'b' ORDER BY username", ["user_id", "email", "username"]);

  console.log("=".repeat(60));
  console.log("HASH — equality only");
  console.log("=".repeat(60));
  await db.printTable(
    "SELECT s.session_id, u.username, s.token FROM idx_sessions s JOIN idx_users u ON u.user_id = s.user_id WHERE s.token = $1",
    ["session_id", "username", "token"],
    ["tok_x9y8z7w6v5u4"]
  );

  console.log("=".repeat(60));
  console.log("GIN (array) — @> contains, && overlap");
  console.log("=".repeat(60));
  await db.printTable("SELECT article_id, title, tags FROM idx_articles WHERE tags @> ARRAY['postgresql','javascript']", ["article_id", "title", "tags"]);
  await db.printTable("SELECT article_id, title, tags FROM idx_articles WHERE tags && ARRAY['javascript','nosql']", ["article_id", "title", "tags"]);

  console.log("=".repeat(60));
  console.log("GIN (tsvector) — @@ full-text match");
  console.log("=".repeat(60));
  await db.printTable(
    "SELECT article_id, title FROM idx_articles WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'postgresql')",
    ["article_id", "title"]
  );
  await db.printTable(
    "SELECT article_id, title FROM idx_articles WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'full & text')",
    ["article_id", "title"]
  );

  console.log("=".repeat(60));
  console.log("GiST (daterange) — && overlap, @> contains date");
  console.log("=".repeat(60));
  await db.printTable(
    "SELECT event_id, name, period FROM idx_events WHERE period && '[2026-06-01,2026-06-30]'::daterange ORDER BY lower(period)",
    ["event_id", "name", "period"]
  );
  await db.printTable("SELECT event_id, name, period FROM idx_events WHERE period @> '2026-06-10'::date", ["event_id", "name", "period"]);

  console.log("SUMMARY: B-tree by default; Hash for equality-only; GIN for arrays/JSONB/FTS;");
  console.log("GiST for ranges/geometry. When in doubt, B-tree + EXPLAIN ANALYZE.");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
