/**
 * Sliding Window Rate Limiting
 * =============================
 * The window moves with time: at each request, count requests in the last N
 * seconds. A Redis sorted set stores one entry per request (score = timestamp).
 *
 *   ZREMRANGEBYSCORE key 0 now-window     ← evict entries that aged out
 *   ZCARD key                             ← count what is left in the window
 *   ZADD key now member                   ← record this request, if allowed
 *   EXPIRE key window
 *
 * All four run atomically in one Lua script. Unlike fixed window, a boundary
 * burst IS caught because those requests stay inside the rolling window.
 * Trade-off: one entry per request (vs one integer for fixed window).
 *
 * Note the order: count first, and only record the request when it is allowed.
 * Recording first is the easy mistake — a denied request then sits in the sorted
 * set for a full window and counts against the caller, so a client that keeps
 * retrying while blocked never gets back under the limit and effectively bans
 * itself. Some gateways want that (it punishes hammering); if you do, make it a
 * decision rather than a side effect of writing the ZADD on the wrong line.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 02_sliding_window.ts
 */

import crypto from "node:crypto";
import * as redisRl from "./redis_rl.js";

const LIMIT = 5;
const WINDOW = 10; // seconds

const LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < tonumber(ARGV[4]) then
  redis.call('ZADD', key, now, member)
  count = count + 1
  redis.call('EXPIRE', key, window)
  return {1, count}
end
redis.call('EXPIRE', key, window)
return {0, count}
`;

// What the limiter hands back. Naming it keeps the four demos comparable.
interface Decision {
  allowed: boolean;
  count: number;
}

async function isAllowed(identifier: string, now: number): Promise<Decision> {
  const key = `rl:sliding:${identifier}`;
  const member = `${now}:${crypto.randomUUID()}`;
  // eval() returns `unknown`: Redis can reply with any type, and only the Lua
  // script above says it is a two-element array here.
  const reply = (await redisRl.client.eval(LUA, 1, key, now, WINDOW, member, LIMIT)) as [
    unknown,
    unknown,
  ];
  const [allowed, count] = reply;
  return { allowed: Number(allowed) === 1, count: Number(count) };
}

async function makeRequests(
  identifier: string,
  timestamps: number[],
  label: string
): Promise<void> {
  console.log(`\n  ${label}`);
  let i = 0;
  for (const ts of timestamps) {
    i += 1;
    const { allowed, count } = await isAllowed(identifier, ts);
    console.log(`    req ${String(i).padStart(2)}  t=${ts.toFixed(1)}  [${allowed ? "ALLOW" : "DENY "}]  window count: ${count}/${LIMIT}`);
  }
}

async function main(): Promise<void> {
  await redisRl.flush();
  console.log("=== Sliding Window Rate Limiting ===");
  console.log(`    limit=${LIMIT} requests per ${WINDOW}s rolling window`);
  const base = 1000.0;

  console.log("\n--- Normal traffic: 5 requests spread over the window ---");
  await redisRl.flush();
  await makeRequests("user:1", Array.from({ length: 5 }, (_, i) => base + i * 2), "5 requests, 2s apart");

  console.log("\n--- 7 rapid requests: first 5 allowed, then 2 denied ---");
  await redisRl.flush();
  await makeRequests("user:1", Array.from({ length: 7 }, (_, i) => base + i * 0.1), "7 requests within 1 second");

  console.log("\n--- Boundary burst: 5 near window end, 5 at start of next ---");
  await redisRl.flush();
  const burst = [
    ...Array.from({ length: 5 }, (_, i) => base + 9 + i * 0.1),
    ...Array.from({ length: 5 }, (_, i) => base + 11 + i * 0.1),
  ];
  await makeRequests("user:1", burst, "5 at t≈9s, 5 at t≈11s (2s gap)");
  console.log("    → Sliding window catches the burst fixed window missed.");

  // Why denied requests must not be recorded: a client that keeps retrying while
  // blocked has to be able to get back in once the earliest request ages out. If
  // each rejected retry were added to the set, the window would keep refilling
  // from the retries alone and the client would never recover.
  console.log("\n--- Recovery: hit the limit, keep retrying, get back in ---");
  await redisRl.flush();
  await makeRequests("user:1", Array.from({ length: 5 }, (_, i) => base + i * 0.1), "5 requests, limit reached");
  await makeRequests(
    "user:1",
    [base + 2, base + 4, base + 6, base + 8, base + 10.1],
    "retrying every 2s while blocked"
  );
  console.log("    → The retry at t=10.1s is allowed: the first request has aged out.");
  console.log("      Had the denied retries been recorded, it would still be blocked.");

  await redisRl.client.quit();
}

main().catch((err) => {
  console.error("ERROR (is Redis running?):", err.message);
  process.exit(1);
});
