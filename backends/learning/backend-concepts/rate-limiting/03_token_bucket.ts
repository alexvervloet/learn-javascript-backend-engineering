/**
 * Token Bucket Rate Limiting
 * ===========================
 * A bucket holds up to `capacity` tokens, refilling at `rate` tokens/second.
 * Each request costs one token; an empty bucket means denial.
 *
 *   tokens vs sliding window: token bucket ALLOWS bursts up to capacity, then
 *   enforces a sustained average rate. Good for APIs where occasional bursts are
 *   legitimate (a bulk import) but sustained hammering is not.
 *
 * Two keys per identifier (tokens + last refill time). The read-modify-write
 * runs in one Lua script so concurrent requests can't double-spend a token.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 03_token_bucket.ts
 */

import * as redisRl from "./redis_rl.js";

const CAPACITY = 10;
const RATE = 2.0; // tokens/second
const COST = 1;
const TTL = Math.floor(CAPACITY / RATE) + 5;

const LUA = `
local tokens_key = KEYS[1]
local last_key   = KEYS[2]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local cost     = tonumber(ARGV[3])
local now      = tonumber(ARGV[4])
local ttl      = tonumber(ARGV[5])

local last   = tonumber(redis.call('GET', last_key))   or now
local tokens = tonumber(redis.call('GET', tokens_key)) or capacity
local elapsed = math.max(0, now - last)
local new_tokens = math.min(capacity, tokens + elapsed * rate)

if new_tokens >= cost then
  redis.call('SET', tokens_key, new_tokens - cost)
  redis.call('SET', last_key, now)
  redis.call('EXPIRE', tokens_key, ttl); redis.call('EXPIRE', last_key, ttl)
  return {1, math.floor(new_tokens - cost)}
else
  redis.call('SET', tokens_key, new_tokens)
  redis.call('SET', last_key, now)
  redis.call('EXPIRE', tokens_key, ttl); redis.call('EXPIRE', last_key, ttl)
  return {0, 0}
end
`;

// The token bucket reports its level rather than a request count.
interface BucketDecision {
  allowed: boolean;
  tokens: number;
}

async function isAllowed(identifier: string, now: number): Promise<BucketDecision> {
  // eval() returns `unknown`: Redis can reply with any type, and only the Lua
  // script above says it is a two-element array here.
  const reply = (await redisRl.client.eval(
    LUA,
    2,
    `rl:bucket:${identifier}:tokens`,
    `rl:bucket:${identifier}:last`,
    CAPACITY,
    RATE,
    COST,
    now,
    TTL
  )) as [unknown, unknown];
  const [allowed, tokens] = reply;
  return { allowed: Number(allowed) === 1, tokens: Number(tokens) };
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
    const { allowed, tokens } = await isAllowed(identifier, ts);
    console.log(`    req ${String(i).padStart(2)}  t=${(ts - timestamps[0]).toFixed(1)}s  [${allowed ? "ALLOW" : "DENY "}]  tokens after: ${tokens}`);
  }
}

async function main(): Promise<void> {
  await redisRl.flush();
  console.log("=== Token Bucket Rate Limiting ===");
  console.log(`    capacity=${CAPACITY} tokens  rate=${RATE} tokens/s  cost=${COST}/request`);
  const base = 1000.0;

  console.log("\n--- Burst: 13 rapid requests, only 10 fit ---");
  await redisRl.flush();
  await makeRequests("user:1", Array.from({ length: 13 }, (_, i) => base + i * 0.05), "13 requests in 0.6s (bucket holds 10)");

  console.log("\n--- Refill: burst, wait 3s, burst again (6 new tokens) ---");
  await redisRl.flush();
  const pattern = [
    ...Array.from({ length: 10 }, (_, i) => base + i * 0.05),
    ...Array.from({ length: 8 }, (_, i) => base + 3.0 + i * 0.05),
  ];
  await makeRequests("user:1", pattern, "burst-wait-burst pattern");

  console.log("\n--- Sustained load: 1 req/s, always allowed (rate=2/s) ---");
  await redisRl.flush();
  await makeRequests("user:1", Array.from({ length: 12 }, (_, i) => base + i), "1 request per second");

  await redisRl.client.quit();
}

main().catch((err) => {
  console.error("ERROR (is Redis running?):", err.message);
  process.exit(1);
});
