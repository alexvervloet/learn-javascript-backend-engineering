/**
 * Schema setup — enable the pgvector extension and create the tables.
 *
 * (It's one raw-SQL script, since the only notable bit is `CREATE EXTENSION
 * vector` + a vector(768) column. You could equally manage this with Knex —
 * see db-migration-demo.)
 *
 * nomic-embed-text produces 768-dimensional vectors.
 *
 * Run:  docker compose up -d (Postgres + pgvector)  →  npx tsx setup.ts
 */

import { pool } from "./db.js";

const EMBEDDING_DIM = 768;

async function main() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE comments (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIM}),   -- NULL until embed_comments.js runs
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log(`Schema ready: users, comments (embedding vector(${EMBEDDING_DIM})).`);
  await pool.end();
}

main().catch((err) => {
  console.error("ERROR (is Postgres+pgvector running?):", err.message);
  process.exit(1);
});
