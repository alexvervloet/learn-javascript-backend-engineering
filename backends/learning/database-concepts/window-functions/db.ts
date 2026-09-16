// Shared Postgres helper (node-postgres) for the window-function demos.

import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "window_functions",
  user: process.env.DB_USER || process.env.USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

// Generic over the row type, so a caller says what a query returns at the
// call site — pg cannot know from the SQL string.
const query = <T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> => pool.query<T>(sql, params);
const close = (): Promise<void> => pool.end();

async function printTable(
  sql: string,
  headers: string[],
  params: unknown[] = []
): Promise<void> {
  const { rows } = await pool.query(sql, params);
  const cells = rows.map((r) => Object.values(r));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((row) => String(row[i] ?? "NULL").length), 0)
  );
  const fmt = (vals: unknown[]): string =>
    vals.map((v, i) => String(v ?? "NULL").padEnd(widths[i] ?? 0)).join("  ");
  console.log(fmt(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of cells) console.log(fmt(row));
  console.log();
}

export { pool, query, close, printTable };
