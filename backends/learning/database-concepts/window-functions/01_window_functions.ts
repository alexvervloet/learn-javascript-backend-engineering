/**
 * Window Functions
 * ================
 * A window function computes a value per row from a *window* of related rows,
 * WITHOUT collapsing them the way GROUP BY does. The OVER clause makes it a
 * window function.
 *
 *   fn(...) OVER (PARTITION BY ... ORDER BY ... [frame])
 *
 *   Ranking : ROW_NUMBER (1,2,3) · RANK (1,1,3) · DENSE_RANK (1,1,2)
 *   Offset  : LAG(col,n) / LEAD(col,n) — value n rows before/after
 *   Running : SUM(col) OVER (ORDER BY date) — default frame is "everything so far"
 *   Partition aggregate: AVG(col) OVER (PARTITION BY cat) — same value per group row
 *
 * Gotcha: you can't filter on a window function in WHERE — wrap it in a CTE/subquery.
 * Pure SQL — runnable as-is.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 01_window_functions.ts
 */

import * as db from "./db.js";

const SETUP = `
DROP TABLE IF EXISTS wf_sales;
CREATE TABLE wf_sales (
  sale_id SERIAL PRIMARY KEY, rep TEXT NOT NULL, category TEXT NOT NULL,
  amount INT NOT NULL, sale_date DATE NOT NULL
);
`;

const SEED = `
INSERT INTO wf_sales (rep, category, amount, sale_date) VALUES
  ('Alice','Electronics',1200,'2026-01-05'),('Bob','Electronics',1200,'2026-01-12'),
  ('Carol','Electronics',900,'2026-01-18'),('David','Electronics',750,'2026-01-22'),
  ('Alice','Clothing',400,'2026-02-03'),('Bob','Clothing',550,'2026-02-08'),
  ('Carol','Clothing',550,'2026-02-14'),('David','Clothing',300,'2026-02-19'),
  ('Alice','Books',200,'2026-03-02'),('Bob','Books',150,'2026-03-09'),
  ('Carol','Books',200,'2026-03-15'),('David','Books',350,'2026-03-20'),
  ('Alice','Electronics',950,'2026-04-01'),('Bob','Clothing',480,'2026-04-10'),
  ('Carol','Books',180,'2026-04-17');
`;

async function main() {
  await db.query(SETUP);
  await db.query(SEED);

  console.log("=".repeat(68));
  console.log("RANKING — ROW_NUMBER / RANK / DENSE_RANK (Electronics tie at 1200)");
  console.log("=".repeat(68));
  await db.printTable(
    `SELECT category, rep, amount,
       ROW_NUMBER() OVER (PARTITION BY category ORDER BY amount DESC) AS row_num,
       RANK()       OVER (PARTITION BY category ORDER BY amount DESC) AS rank,
       DENSE_RANK() OVER (PARTITION BY category ORDER BY amount DESC) AS dense_rank
     FROM wf_sales ORDER BY category, amount DESC, rep`,
    ["category", "rep", "amount", "row_num", "rank", "dense_rank"]
  );

  console.log("=".repeat(68));
  console.log("RUNNING TOTAL — SUM() OVER (PARTITION BY rep ORDER BY sale_date)");
  console.log("=".repeat(68));
  await db.printTable(
    `SELECT rep, sale_date, category, amount,
       SUM(amount) OVER (PARTITION BY rep ORDER BY sale_date) AS running_total
     FROM wf_sales ORDER BY rep, sale_date`,
    ["rep", "sale_date", "category", "amount", "running_total"]
  );

  console.log("=".repeat(68));
  console.log("LAG — compare each sale to the same rep's previous sale");
  console.log("=".repeat(68));
  await db.printTable(
    `SELECT rep, sale_date, amount, prev_amount, amount - prev_amount AS change FROM (
       SELECT rep, sale_date, amount,
         LAG(amount, 1) OVER (PARTITION BY rep ORDER BY sale_date) AS prev_amount
       FROM wf_sales
     ) t ORDER BY rep, sale_date`,
    ["rep", "sale_date", "amount", "prev_amount", "change"]
  );

  console.log("=".repeat(68));
  console.log("PARTITIONED AGGREGATE — AVG() OVER (PARTITION BY category)");
  console.log("=".repeat(68));
  await db.printTable(
    `SELECT category, rep, amount,
       ROUND(AVG(amount) OVER (PARTITION BY category)) AS cat_avg,
       amount - ROUND(AVG(amount) OVER (PARTITION BY category)) AS vs_avg
     FROM wf_sales ORDER BY category, amount DESC`,
    ["category", "rep", "amount", "cat_avg", "vs_avg"]
  );

  console.log("=".repeat(68));
  console.log("TOP N PER GROUP — ROW_NUMBER in a CTE, then filter");
  console.log("=".repeat(68));
  await db.printTable(
    `WITH ranked AS (
       SELECT category, rep, amount,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY amount DESC) AS rn
       FROM wf_sales
     )
     SELECT category, rep, amount FROM ranked WHERE rn = 1 ORDER BY category`,
    ["category", "rep", "amount"]
  );
  console.log("ROW_NUMBER breaks ties arbitrarily; use RANK() + WHERE rn = 1 to keep tied leaders.");

  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
