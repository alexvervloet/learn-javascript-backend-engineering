/**
 * Full-Text Search Basics: tsvector and tsquery
 * ==============================================
 *   tsvector — preprocessed document: text split into normalised lexemes with
 *     stop words removed. to_tsvector('english','The foxes are quickly running')
 *     → 'fox':2 'quick':4 'run':5
 *   tsquery  — a search expression of lexemes with & (AND) | (OR) ! (NOT) <-> (phrase)
 *   @@       — match operator: does this tsvector satisfy this tsquery?
 *
 * Building queries:
 *   to_tsquery        operators must be explicit ('database & index')
 *   plainto_tsquery   spaces become AND — safe for raw user input
 *   websearch_to_tsquery   web syntax: "quoted phrases", OR, -minus
 *   phraseto_tsquery  all words in order, adjacent
 *
 * Run: npx tsx 01_basics.ts
 */

import * as db from "./db.js";

async function main() {
  console.log("=".repeat(60));
  console.log("TSVECTOR — text after processing");
  console.log("=".repeat(60));
  console.log("Input: 'The foxes are quickly running over lazy dogs'");
  console.log(`tsvector: ${(await db.query("SELECT to_tsvector('english','The foxes are quickly running over lazy dogs') AS v")).rows[0].v}`);
  console.log("Stop words dropped; foxes→fox, quickly→quick, running→run (stemmed).\n");

  console.log("=".repeat(60));
  console.log("STOP WORDS — common words with no search value");
  console.log("=".repeat(60));
  for (const phrase of ["the quick brown fox", "a very important thing", "this is the way"]) {
    const v = (await db.query("SELECT to_tsvector('english', $1) AS v", [phrase])).rows[0].v;
    console.log(`  '${phrase}'  →  ${v || "(empty — all stop words)"}`);
  }
  console.log();

  console.log("=".repeat(60));
  console.log("QUERY FUNCTIONS — four ways to build a tsquery");
  console.log("=".repeat(60));
  const examples = [
    ["to_tsquery", "to_tsquery('english', 'database & index')"],
    ["plainto_tsquery", "plainto_tsquery('english', 'database index')"],
    ["websearch (phrase)", `websearch_to_tsquery('english', '"full text search"')`],
    ["websearch (OR/NOT)", "websearch_to_tsquery('english', 'database OR index -slow')"],
    ["phraseto_tsquery", "phraseto_tsquery('english', 'full text search')"],
  ];
  for (const [label, expr] of examples) {
    console.log(`  ${label}:  ${(await db.query(`SELECT ${expr} AS q`)).rows[0].q}`);
  }
  console.log("  <-> = followed-by (phrase),  & = AND,  | = OR,  ! = NOT\n");

  console.log("=".repeat(60));
  console.log("@@ — does this document match the query?");
  console.log("=".repeat(60));
  const tests = [
    ["PostgreSQL has powerful full-text search features", "full-text search"],
    ["Node is great for building APIs and services", "full-text search"],
    ["Running queries on a database requires an index", "running query"],
  ];
  for (const [doc, q] of tests) {
    const match = (await db.query("SELECT to_tsvector('english',$1) @@ plainto_tsquery('english',$2) AS m", [doc, q])).rows[0].m;
    console.log(`  ${match ? "✓" : "✗"}  ${JSON.stringify(q)}  in  ${JSON.stringify(doc.slice(0, 45))}`);
  }
  console.log();

  console.log("=".repeat(60));
  console.log("SEARCHING ARTICLES — basic @@ query against the table");
  console.log("=".repeat(60));
  await db.query(db.SETUP);
  await db.query(db.SEED);
  for (const [label, expr] of [["database", "plainto_tsquery('english','database')"], ["index performance", "plainto_tsquery('english','index performance')"]]) {
    console.log(`  Search: '${label}'`);
    await db.printTable(
      `SELECT id, title, author FROM articles WHERE to_tsvector('english', title || ' ' || body) @@ ${expr} ORDER BY id`,
      ["id", "title", "author"]
    );
  }
  console.log("  No ranking yet, and to_tsvector runs per row per search — see 03_indexes.ts.\n");

  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
