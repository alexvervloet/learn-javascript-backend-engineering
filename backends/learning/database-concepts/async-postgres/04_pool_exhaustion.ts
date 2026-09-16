/**
 * Pool Exhaustion
 * ================
 * When every connection (up to `max`) is in use and another request needs one,
 * the caller waits up to connectionTimeoutMillis, then errors:
 *
 *   Error: timeout exceeded when trying to connect
 *
 * One of the most common production DB errors — shows up as 500s after a traffic
 * spike and latency spikes exactly at the timeout. Root cause is almost always
 * holding connections too long (slow queries, awaiting non-DB work inside the
 * checkout), NOT just "max is too small".
 *
 * This spawns 10 concurrent holders against a pool of 3. Run: npx tsx 04_pool_exhaustion.ts
 */

import * as db from "./db.js";
import type { Pool } from "pg";

const HOLD_MS = 3000;
const TIMEOUT_MS = 2000;
const N = 10;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Hold a connection for the whole HOLD_MS (the bad pattern).
// Both workers have this shape, so naming it lets run() take either one.
type Worker = (pool: Pool, id: number) => Promise<string>;

async function holdWhole(pool: Pool, id: number): Promise<string> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      await sleep(HOLD_MS); // simulates a slow query / non-DB work in the checkout
      return `task-${String(id).padStart(2, "0")}  OK`;
    } finally {
      client.release();
    }
  } catch {
    return `task-${String(id).padStart(2, "0")}  TIMEOUT (waited ${TIMEOUT_MS / 1000}s, no connection)`;
  }
}

// Release the connection BEFORE the slow part (the good pattern).
async function releaseEarly(pool: Pool, id: number): Promise<string> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release(); // connection back in the pool immediately
    }
    await sleep(HOLD_MS); // slow work happens OUTSIDE the checkout
    return `task-${String(id).padStart(2, "0")}  OK (held only during the query)`;
  } catch {
    return `task-${String(id).padStart(2, "0")}  TIMEOUT`;
  }
}

async function run(label: string, worker: Worker, max: number): Promise<void> {
  const pool = db.makePool({ max, connectionTimeoutMillis: TIMEOUT_MS, idleTimeoutMillis: 1000 });
  const results = await Promise.all(Array.from({ length: N }, (_, i) => worker(pool, i)));
  const ok = results.filter((r) => r.includes("OK")).length;
  console.log(`\n=== ${label} ===`);
  for (const r of results.sort()) console.log(`  ${r}`);
  console.log(`  → ${ok}/${N} succeeded`);
  await pool.end();
}

async function main(): Promise<void> {
  // 1. Exhaustion: max=3, 10 holders each holding 3s, timeout 2s.
  await run(`Exhaustion (max=3, hold whole ${HOLD_MS / 1000}s)`, holdWhole, 3);
  // 2. Naive fix: bigger pool.
  await run(`Bigger pool (max=${N})`, holdWhole, N);
  // 3. Better fix: release early — small pool handles all 10.
  await run("Release early (max=3, slow work outside the checkout)", releaseEarly, 3);

  console.log(`
  Takeaways:
  1. Exhaustion is usually a hold-time problem, not a max-size problem.
  2. Never hold a connection while awaiting non-DB work (HTTP, sleep, CPU).
  3. At high concurrency, put PgBouncer in front so many app conns share few DB conns.`);
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
