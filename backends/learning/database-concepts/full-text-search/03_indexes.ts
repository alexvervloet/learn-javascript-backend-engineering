/**
 * Stored tsvector, Triggers, and GIN Indexes
 * ==========================================
 * Calling to_tsvector() per row at search time is fine for 15 rows, slow for a
 * million. The production pattern:
 *   1. A stored `search_vector` column (compute once).
 *   2. A BEFORE INSERT/UPDATE trigger to keep it current.
 *   3. A GIN index on it (maps lexemes → row ids, like a book index).
 *
 * GIN = faster reads / slower writes (best for mostly-static text).
 * EXPLAIN ANALYZE shows Seq Scan → Bitmap Index Scan as you add the column + index.
 *
 * Run: npx tsx 03_indexes.ts
 */

import * as db from "./db.js";

// EXPLAIN returns one text column per plan line, always named "QUERY PLAN".
interface ExplainRow {
  "QUERY PLAN": string;
}

async function main() {
  await db.query(db.SETUP);
  await db.query(db.SEED);

  console.log("=".repeat(60));
  console.log("STORED TSVECTOR COLUMN — compute once, query many times");
  console.log("=".repeat(60));
  await db.query("ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector TSVECTOR");
  await db.query(`UPDATE articles SET search_vector =
    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')`);
  const sample = (await db.query("SELECT id, title, search_vector FROM articles ORDER BY id LIMIT 2")).rows;
  for (const r of sample) {
    console.log(`  [${r.id}] ${r.title}`);
    console.log(`       ${String(r.search_vector).slice(0, 110)}…`);
  }
  console.log("  Weights show as 'databas':4A (title) vs 'index':5B (body).\n");

  console.log("=".repeat(60));
  console.log("TRIGGER — keep search_vector in sync automatically");
  console.log("=".repeat(60));
  await db.query(`
    CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vector := setweight(to_tsvector('english', NEW.title), 'A') || setweight(to_tsvector('english', NEW.body), 'B');
      RETURN NEW;
    END; $$;`);
  await db.query(`
    DROP TRIGGER IF EXISTS articles_search_vector_trigger ON articles;
    CREATE TRIGGER articles_search_vector_trigger BEFORE INSERT OR UPDATE OF title, body ON articles
      FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();`);
  const inserted = (
    await db.query(`INSERT INTO articles (title, body, author)
      VALUES ('Trigger Test Article','This article tests that the trigger fires on insert.','alice')
      RETURNING id, search_vector`)
  ).rows[0];
  console.log(`  Inserted id=${inserted.id} WITHOUT setting search_vector — trigger filled it:`);
  console.log(`  ${String(inserted.search_vector).slice(0, 90)}…`);
  await db.query("DELETE FROM articles WHERE id = $1", [inserted.id]);
  console.log("  The trigger fires BEFORE INSERT/UPDATE OF title, body — app code never sets it.\n");

  console.log("=".repeat(60));
  console.log("GIN INDEX — EXPLAIN ANALYZE before and after");
  console.log("=".repeat(60));
  const q = "plainto_tsquery('english','database index')";
  const explain = async (label: string, sql: string): Promise<void> => {
    console.log(`  ${label}:`);
    const { rows } = await db.query<ExplainRow>(`EXPLAIN ANALYZE ${sql}`);
    for (const r of rows) console.log(`    ${r["QUERY PLAN"]}`);
    console.log();
  };
  await explain("live to_tsvector() per row (seq scan)", `SELECT id FROM articles WHERE to_tsvector('english', title || ' ' || body) @@ ${q}`);
  await db.query("CREATE INDEX IF NOT EXISTS articles_search_vector_gin ON articles USING GIN (search_vector)");
  await db.query("ANALYZE articles");
  await explain("stored column, no index", `SELECT id FROM articles WHERE search_vector @@ ${q}`);
  await db.query("SET enable_seqscan = off");
  await explain("GIN index (enable_seqscan=off to force it at small scale)", `SELECT id FROM articles WHERE search_vector @@ ${q}`);
  await db.query("SET enable_seqscan = on");
  console.log("  Stage 1 recomputes per row; stage 2 reads the stored column; stage 3 uses the GIN");
  console.log("  index (Bitmap Index Scan) so cost grows with result size, not table size.\n");

  console.log("=".repeat(60));
  console.log("FINAL PATTERN — stored vector + GIN + weighted ranking");
  console.log("=".repeat(60));
  await db.printTable(
    `SELECT id, title, author,
       round(ts_rank(search_vector, plainto_tsquery('english','full text search'))::numeric, 5) AS rank
     FROM articles WHERE search_vector @@ plainto_tsquery('english','full text search')
     ORDER BY rank DESC`,
    ["id", "title", "author", "rank"],
    [],
    48
  );

  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
