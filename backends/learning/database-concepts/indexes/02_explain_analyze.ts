/**
 * EXPLAIN ANALYZE — Reading Query Plans
 * ======================================
 * EXPLAIN shows the planner's chosen plan; EXPLAIN ANALYZE runs the query and
 * adds real timings + row counts beside the estimates.
 *
 *   cost=A..B    planner estimate (A=startup, B=total; abstract units)
 *   rows=N       estimated output rows; actual rows=N is the real count
 *   Filter:      checked AFTER fetch → wasted reads ("Rows Removed by Filter")
 *   Index Cond:  resolved BY the index → no wasted reads
 *
 * Key question: are estimated rows close to actual rows? A big gap = stale
 * statistics → run ANALYZE.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 02_explain_analyze.ts
 */

import * as db from "./db.js";

const SETUP = `
DROP TABLE IF EXISTS exp_orders;
DROP TABLE IF EXISTS exp_products;
CREATE TABLE exp_products (
  product_id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC(10,2) NOT NULL
);
CREATE TABLE exp_orders (
  order_id SERIAL PRIMARY KEY, user_id INT NOT NULL, status TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL, created_at DATE NOT NULL
);
`;

const SEED = `
INSERT INTO exp_products (name, category, price)
SELECT 'Product ' || i,
  CASE (i % 4) WHEN 0 THEN 'electronics' WHEN 1 THEN 'clothing' WHEN 2 THEN 'food' ELSE 'books' END,
  (random() * 500 + 1)::NUMERIC(10,2)
FROM generate_series(1, 200) i;

INSERT INTO exp_orders (user_id, status, amount, created_at)
SELECT (random() * 999 + 1)::INT,
  CASE (i % 10) WHEN 0 THEN 'cancelled' WHEN 1 THEN 'refunded' ELSE 'completed' END,
  (random() * 1000 + 1)::NUMERIC(10,2),
  '2025-01-01'::DATE + (random() * 364)::INT
FROM generate_series(1, 50000) i;

ANALYZE exp_products;
ANALYZE exp_orders;
`;

// EXPLAIN returns one text column per plan line, always named "QUERY PLAN".
interface ExplainRow {
  "QUERY PLAN": string;
}

async function explain(label: string, sql: string): Promise<void> {
  console.log(`\n${"─".repeat(60)}\n  ${label}\n${"─".repeat(60)}`);
  const { rows } = await db.query<ExplainRow>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  for (const row of rows) console.log(row["QUERY PLAN"]);
  console.log();
}

const section = (t: string): void => console.log(`\n${"=".repeat(60)}\n  ${t}\n${"=".repeat(60)}`);

async function main(): Promise<void> {
  await db.query(SETUP);
  await db.query(SEED);

  section("1. SEQ SCAN — small table (expected, correct)");
  await db.query("CREATE INDEX exp_idx_product_category ON exp_products(category)");
  await explain("WHERE category = 'electronics' on a 200-row table", "SELECT * FROM exp_products WHERE category = 'electronics'");
  console.log("The index exists but is ignored — correct for a tiny table.");

  section("2. SEQ SCAN — large table WITHOUT index (problem)");
  await explain("WHERE user_id = 42 (no index — full scan)", "SELECT * FROM exp_orders WHERE user_id = 42");
  console.log("'Rows Removed by Filter' ~49,950 — almost everything fetched then discarded.");

  section("3. INDEX SCAN — same query, with index added");
  await db.query("CREATE INDEX exp_idx_orders_user ON exp_orders(user_id)");
  await explain("WHERE user_id = 42 (B-tree present)", "SELECT * FROM exp_orders WHERE user_id = 42");
  console.log("Now an Index Scan with 'Index Cond' — no wasted reads, far faster.");

  section("4. SEQ SCAN — low selectivity (planner correctly ignores the index)");
  await db.query("CREATE INDEX exp_idx_orders_status ON exp_orders(status)");
  await explain("WHERE status = 'completed' (~80% match)", "SELECT * FROM exp_orders WHERE status = 'completed'");
  console.log("Fetching 80% via index causes more random I/O than a seq scan — the planner is right.");

  section("5. STALE STATISTICS — estimated vs actual rows");
  console.log("Insert 10,000 'refunded' rows WITHOUT ANALYZE — the estimate goes stale.\n");
  await db.query(`
    INSERT INTO exp_orders (user_id, status, amount, created_at)
    SELECT (random()*999+1)::INT, 'refunded', (random()*1000+1)::NUMERIC(10,2), '2025-01-01'::DATE + (random()*364)::INT
    FROM generate_series(1, 10000) i`);
  await explain("status = 'refunded' (before ANALYZE)", "SELECT count(*) FROM exp_orders WHERE status = 'refunded'");
  console.log("  → Running ANALYZE...\n");
  await db.query("ANALYZE exp_orders");
  await explain("status = 'refunded' (after ANALYZE)", "SELECT count(*) FROM exp_orders WHERE status = 'refunded'");
  console.log("Estimate now matches actual. Run ANALYZE after bulk writes.");

  section("DIAGNOSTIC CHECKLIST");
  console.log(`  Seeing a Seq Scan? Ask:
  1. Small table (<1000 rows)?         → Seq Scan is correct.
  2. Filter matches >~10-20% of rows?  → Seq Scan is correct.
  3. No index on the filtered column?  → add one, re-EXPLAIN.
  4. estimate ≫ / ≪ actual rows?       → run ANALYZE.
  5. High 'Rows Removed by Filter'?    → consider a more selective / partial index.
  Golden rule: never guess — EXPLAIN ANALYZE before and after.`);

  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
