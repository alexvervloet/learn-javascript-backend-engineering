/**
 * The N+1 Problem
 * ===============
 * Load N parent rows, then fetch a relationship for each one, and you fire one
 * query per parent on top of the original — N+1 queries total. With 5 authors
 * it's 6; with 500 it's 501. It's silent: the code looks fine and the results
 * are correct, but round-trips grow linearly with your data.
 *
 * ORMs (Prisma, Drizzle) hide this behind lazy-loaded property access. Here we
 * use raw `pg`, so each query is an explicit call the counter sees.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 01_n_plus_one.ts
 */

import * as db from "./db.js";
import type { Author, Book, Tag } from "./db.js";

async function demoOneLevel(): Promise<void> {
  console.log("=".repeat(60));
  console.log("N+1 — authors → books  (1 + N queries)");
  console.log("=".repeat(60));
  console.log("Fetch authors, then fetch each author's books in a loop:\n");

  const queries = await db.withQueryLog(
    async () => {
      const authors = (await db.query<Author>("SELECT * FROM authors")).rows;
      for (const author of authors) {
        // One query per author — this is the "+N".
        // eslint-disable-next-line no-await-in-loop
        await db.query<Book>("SELECT title FROM books WHERE author_id = $1", [author.id]);
      }
    },
    { showSql: true }
  );

  console.log(`  Query 1 fetched authors; queries 2–${queries.length} fetched books one author at a time.\n`);
}

async function demoTwoLevels(): Promise<void> {
  console.log("=".repeat(60));
  console.log("NESTED N+1 — authors → books → tags  (1 + N + N×M queries)");
  console.log("=".repeat(60));

  const queries = await db.withQueryLog(async () => {
    const authors = (await db.query<Author>("SELECT * FROM authors")).rows;
    for (const author of authors) {
      // eslint-disable-next-line no-await-in-loop
      const books = (await db.query<Book>("SELECT * FROM books WHERE author_id = $1", [author.id])).rows;
      for (const book of books) {
        // eslint-disable-next-line no-await-in-loop
        await db.query<Tag>("SELECT t.name FROM tags t JOIN book_tags bt ON bt.tag_id = t.id WHERE bt.book_id = $1", [book.id]);
      }
    }
  });

  console.log(`  ${queries.length} queries to render a simple nested list. Add data and it explodes.\n`);
}

function demoSilent() {
  console.log("=".repeat(60));
  console.log("WHY IT'S SILENT — the code gives no hint");
  console.log("=".repeat(60));
  console.log(`
  These look identical but the second fires far fewer queries:

  // N+1: query per author in the loop
  for (const a of authors) await getBooks(a.id);

  // Eager: one IN-clause query for all authors' books
  const books = await query("SELECT * FROM books WHERE author_id = ANY($1)", [ids]);

  Without a query counter you'd only notice in production, as slow pages.
  See 02_solutions.ts for the fixes.\n`);
}

async function main(): Promise<void> {
  await db.setup();
  await demoOneLevel();
  await demoTwoLevels();
  demoSilent();
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
