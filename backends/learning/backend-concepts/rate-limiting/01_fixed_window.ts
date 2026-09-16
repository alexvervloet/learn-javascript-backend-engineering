/**
 * Fixed Window Rate Limiting
 * ===========================
 * Divide time into equal windows; count requests per identifier per window;
 * reject when the count exceeds the limit.
 *
 *   key   = rl:fixed:{id}:{windowStart}
 *   INCR key; if count == 1 → EXPIRE key TTL; if count > limit → 429
 *
 * INCR + EXPIRE are two commands — a crash between them leaves a stuck counter.
 * A Lua script runs both atomically on the server (used here via client.eval).
 *
 * The boundary-burst flaw: a client can send LIMIT requests at 00:59 and LIMIT
 * more at 01:01 — 2×LIMIT in ~2s, yet both windows look clean. Sliding window
 * (02) fixes this.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 01_fixed_window.ts
 */

import * as redisRl from "./redis_rl.js";

const LIMIT = 5;
const WINDOW = 10; // seconds

// INCR + conditional EXPIRE, atomic.
const LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

const windowStart = (now: number, window: number): number => Math.floor(now / window) * window;

// What each limiter hands back. Naming it keeps the four demos comparable.
interface Decision {
  allowed: boolean;
  count: number;
}

async function isAllowed(identifier: string, now: number): Promise<Decision> {
  const ws = windowStart(Math.floor(now), WINDOW);
  const key = `rl:fixed:${identifier}:${ws}`;
  // eval() returns `unknown`: Redis can reply with any type, and only the Lua
  // script above says it is a number here.
  const count = Number(await redisRl.client.eval(LUA, 1, key, WINDOW));
  return { allowed: count <= LIMIT, count };
}

async function makeRequests(
  identifier: string,
  n: number,
  now: number,
  label: string
): Promise<void> {
  console.log(`\n  ${label}`);
  for (let i = 1; i <= n; i += 1) {
    const { allowed, count } = await isAllowed(identifier, now + i * 0.01);
    console.log(`    req ${String(i).padStart(2)}  [${allowed ? "ALLOW" : "DENY "}]  window count: ${count}/${LIMIT}`);
  }
}

async function main(): Promise<void> {
  await redisRl.flush();
  console.log("=== Fixed Window Rate Limiting ===");
  console.log(`    limit=${LIMIT} requests per ${WINDOW}s window`);

  const now = Date.now() / 1000;
  console.log("\n--- Normal traffic: 4 requests, well under limit ---");
  await makeRequests("user:1", 4, now, "4 requests in window 1");

  console.log("\n--- Burst: 7 requests, 5 allowed then 2 denied ---");
  await redisRl.flush();
  await makeRequests("user:1", 7, now, "7 requests in window 1");

  console.log("\n--- Boundary burst: 5 at end of window, 5 at start of next ---");
  await redisRl.flush();
  const ws = windowStart(Math.floor(now), WINDOW);
  await makeRequests("user:1", 5, ws + WINDOW - 1, "5 requests at window end");
  await makeRequests("user:1", 5, ws + WINDOW, "5 requests at window start (new window)");
  console.log("\n    → All 10 allowed. Fixed window didn't see the burst (sliding window would).");

  await redisRl.client.quit();
}

main().catch((err) => {
  console.error("ERROR (is Redis running?):", err.message);
  process.exit(1);
});
