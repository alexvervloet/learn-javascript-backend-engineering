// Shared Postgres helpers (node-postgres). A `Client` is a single connection;
// `Pool` manages many (see async-postgres/). Everything is async.

import { Client } from "pg";
import type { QueryResultRow } from "pg";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "transactions_demo",
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || "",
};

// A connected client. Two of these simulate concurrent sessions.
async function getClient(): Promise<Client> {
  const client = new Client(config);
  await client.connect();
  return client;
}

// Run work with one short-lived client (for setup/resets/reads).
// Generic over what the callback returns, so withClient(c => c.query(...))
// hands back the query result rather than losing its type.
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setupSchema(): Promise<void> {
  await withClient((c) =>
    c.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY, owner TEXT NOT NULL,
        balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0)
      );
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        on_call BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY, product TEXT NOT NULL, stock INT NOT NULL CHECK (stock >= 0)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY, payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done'))
      );
    `)
  );
}

const resetAccounts = () =>
  withClient(async (c) => {
    await c.query("TRUNCATE accounts RESTART IDENTITY");
    await c.query("INSERT INTO accounts (owner, balance) VALUES ('Alice',1000),('Bob',500),('Carol',250)");
  });

const resetDoctors = () =>
  withClient(async (c) => {
    await c.query("TRUNCATE doctors RESTART IDENTITY");
    await c.query("INSERT INTO doctors (name, on_call) VALUES ('Alice',TRUE),('Bob',TRUE)");
  });

const resetInventory = () =>
  withClient(async (c) => {
    await c.query("TRUNCATE inventory RESTART IDENTITY");
    await c.query("INSERT INTO inventory (product, stock) VALUES ('Widget', 1)");
  });

const resetJobs = () =>
  withClient(async (c) => {
    await c.query("TRUNCATE jobs RESTART IDENTITY");
    await c.query("INSERT INTO jobs (payload) VALUES ('job-1'),('job-2'),('job-3'),('job-4'),('job-5')");
  });

// Pretty-print a result set as an aligned table.
async function printTable(
  query: string,
  headers: string[],
  params: unknown[] = []
): Promise<void> {
  const { rows } = await withClient((c) => c.query<QueryResultRow>(query, params));
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

export {
  config,
  getClient,
  withClient,
  setupSchema,
  resetAccounts,
  resetDoctors,
  resetInventory,
  resetJobs,
  printTable,
};
