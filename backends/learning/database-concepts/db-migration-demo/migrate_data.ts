/**
 * Transfer rows from the SQLite library.db into a PostgreSQL `library` database.
 *
 * Strategy:
 *   1. Read every row from SQLite.
 *   2. Insert into Postgres (here both connections are Knex instances).
 *   3. Reset Postgres sequences so SERIAL auto-increment continues correctly —
 *      inserting explicit IDs does NOT advance the sequence, so the next plain
 *      INSERT would collide on id=1 without this step.
 *
 * Run:  npx tsx migrate_data.ts   (needs a Postgres `library` db with the schema applied)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import knexLib from "knex";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const sqlite = knexLib({
  client: "better-sqlite3",
  connection: { filename: path.join(here, "library.db") },
  useNullAsDefault: true,
});

const pg = knexLib({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "library",
    user: process.env.DB_USER || process.env.USER,
    password: process.env.DB_PASSWORD || "",
  },
});

async function main() {
  // 1. Read from SQLite.
  const authors = await sqlite("authors").select("*");
  const books = await sqlite("books").select("*");
  console.log(`Found ${authors.length} authors and ${books.length} books in SQLite.`);

  // 2. Insert into Postgres (onConflict merge so the script is re-runnable).
  if (authors.length) await pg("authors").insert(authors).onConflict("id").merge();
  if (books.length) await pg("books").insert(books).onConflict("id").merge();
  console.log("Data inserted into PostgreSQL.");

  // 3. Reset sequences to MAX(id)+1.
  for (const table of ["authors", "books"]) {
    await pg.raw(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${table}`
    );
  }
  console.log("Postgres sequences reset — auto-increment continues correctly.");

  // 4. Verify.
  const pgAuthors = await pg("authors").select("*");
  const pgBooks = await pg("books").select("*");
  console.log(`\nVerification — Postgres now has ${pgAuthors.length} authors and ${pgBooks.length} books:`);
  for (const a of pgAuthors) {
    const titles = pgBooks.filter((b) => b.author_id === a.id).map((b) => b.title);
    console.log(`  ${a.name} (${a.birth_year}): ${JSON.stringify(titles)}`);
  }

  await sqlite.destroy();
  await pg.destroy();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
