/**
 * When to Use Each Strategy
 * =========================
 * Batch IN-query and JOIN solve the same problem differently; the right choice
 * depends on cardinality and what else the query does.
 *
 *   JOIN is best for many-to-one / one-to-one (book → author): at most one
 *     related row, so no row multiplication.
 *   Batch IN-query is best for one-to-many / many-to-many (author → books): a
 *     JOIN would multiply rows, and it keeps LIMIT/OFFSET pagination correct
 *     (a JOIN changes the row count, breaking LIMIT).
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 03_tradeoffs.ts
 */

import * as db from "./db.js";
import type { Author, Book, Tag } from "./db.js";

async function demoRowMultiplication(): Promise<void> {
  console.log("=".repeat(60));
  console.log("ROW MULTIPLICATION — why JOIN hurts on collections");
  console.log("=".repeat(60));

  const authorCount = Number((await db.query("SELECT count(*) FROM authors")).rows[0].count);
  const bookCount = Number((await db.query("SELECT count(*) FROM books")).rows[0].count);
  const joinRows = Number(
    (await db.query("SELECT count(*) FROM authors a JOIN books b ON b.author_id = a.id")).rows[0].count
  );

  console.log(`  Authors: ${authorCount}   Books: ${bookCount}`);
  console.log(`  Rows returned by the JOIN: ${joinRows}  (one per author-book pair)\n`);
  console.log(`  A JOIN transfers ${joinRows} rows then collapses to ${authorCount} authors — the`);
  console.log(`  extras are wasted bandwidth. A batch IN-query transfers ${authorCount} + ${bookCount} = ${authorCount + bookCount} rows total.\n`);
}

async function demoJoinOnManyToOne(): Promise<void> {
  console.log("=".repeat(60));
  console.log("JOIN on many-to-one — no row multiplication");
  console.log("=".repeat(60));
  console.log("Each book has exactly one author, so the JOIN adds no extra rows.\n");

  await db.withQueryLog(
    async () => {
      await db.query(`
        SELECT b.title, a.name AS author
        FROM books b JOIN authors a ON a.id = b.author_id`);
    },
    { showSql: true }
  );
  console.log("  Books + authors in 1 query, no duplication — JOIN is the natural choice here.\n");
}

async function demoPagination(): Promise<void> {
  console.log("=".repeat(60));
  console.log("PAGINATION — batch IN-query is safe, JOIN breaks LIMIT");
  console.log("=".repeat(60));
  console.log("Page 1 of authors (LIMIT 3) with their books.\n");

  await db.withQueryLog(async () => {
    // LIMIT applies to the authors query, THEN we fetch their books — correct.
    const page = (await db.query("SELECT * FROM authors ORDER BY id LIMIT 3")).rows;
    await db.query("SELECT * FROM books WHERE author_id = ANY($1)", [page.map((a) => a.id)]);
  });

  console.log(`  Correct: LIMIT 3 returns 3 authors, then their books load separately.
  A 'SELECT ... JOIN books LIMIT 3' would cut 3 JOIN rows (parts of one author) —
  LIMIT on a JOIN counts child rows, not parents.\n`);
}

async function main(): Promise<void> {
  await db.setup();
  await demoRowMultiplication();
  await demoJoinOnManyToOne();
  await demoPagination();
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
