/**
 * Ranking and Highlighting
 * ========================
 *   ts_rank(vec, query)     — score by term frequency
 *   ts_rank_cd(vec, query)  — cover-density: also rewards terms appearing close together
 *   setweight(vec, 'A'..'D')— label lexemes by importance (title=A, body=B); ts_rank honours it
 *   ts_headline(cfg, text, query, opts) — a snippet with matched terms highlighted
 *
 * Run after the table exists
 * (01_basics.ts seeds it).  npx tsx 02_ranking.ts
 */

import * as db from "./db.js";

async function main() {
  // Ensure the table exists/seeded (idempotent for standalone runs).
  await db.query(db.SETUP);
  await db.query(db.SEED);

  console.log("=".repeat(60));
  console.log("ts_rank — score by term frequency (search: 'database')");
  console.log("=".repeat(60));
  await db.printTable(
    `SELECT id, title,
       round(ts_rank(to_tsvector('english', title || ' ' || body), plainto_tsquery('english','database'))::numeric, 6) AS rank
     FROM articles
     WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english','database')
     ORDER BY rank DESC`,
    ["id", "title", "rank"],
    [],
    45
  );

  console.log("=".repeat(60));
  console.log("setweight — boost title matches over body (search: 'search')");
  console.log("=".repeat(60));
  await db.printTable(
    `SELECT id, title,
       round(ts_rank(
         setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B'),
         plainto_tsquery('english','search'))::numeric, 6) AS rank
     FROM articles
     WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english','search')
     ORDER BY rank DESC`,
    ["id", "title", "rank"],
    [],
    50
  );
  console.log("  setweight(vec,'A') labels lexemes weight A; || concatenates tsvectors.\n");

  console.log("=".repeat(60));
  console.log("ts_rank_cd — cover density (search: 'full text search')");
  console.log("=".repeat(60));
  await db.printTable(
    `SELECT id, title,
       round(ts_rank(to_tsvector('english', title || ' ' || body), plainto_tsquery('english','full text search'))::numeric, 6) AS rank,
       round(ts_rank_cd(to_tsvector('english', title || ' ' || body), plainto_tsquery('english','full text search'))::numeric, 6) AS rank_cd
     FROM articles
     WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english','full text search')
     ORDER BY rank_cd DESC`,
    ["id", "title", "rank", "rank_cd"],
    [],
    45
  );

  console.log("=".repeat(60));
  console.log("ts_headline — highlighted snippet (search: 'database index')");
  console.log("=".repeat(60));
  const { rows } = await db.query(
    `SELECT title,
       ts_headline('english', body, plainto_tsquery('english','database index'),
                   'MaxWords=20, MinWords=10, StartSel=>>>, StopSel=<<<') AS snippet
     FROM articles
     WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english','database index')
     ORDER BY ts_rank(to_tsvector('english', title || ' ' || body), plainto_tsquery('english','database index')) DESC
     LIMIT 4`
  );
  for (const r of rows) {
    console.log(`  ${r.title}`);
    console.log(`  Snippet: ${r.snippet}\n`);
  }
  console.log("  >>> / <<< mark matched terms; ts_headline works on raw text, not tsvector.\n");

  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
