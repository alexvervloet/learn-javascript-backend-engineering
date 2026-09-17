/**
 * Redis client (ioredis) and key/serialisation helpers shared across scripts.
 *
 * Key naming convention:
 *   product:{id}        — a single cached product (JSON string)
 *   lock:product:{id}   — distributed lock for stampede protection
 *   pending:writes      — Redis list used by write-behind to queue DB flushes
 *
 * ioredis is the standard 2026 Node Redis client (already used by the backends).
 * Every call is async and returns a promise.
 */

// ioredis is a CommonJS package whose class is both the default and a named
// export. Under nodenext the default import resolves to the module namespace,
// which is not constructable, so take the named one.
import { Redis } from "ioredis";

import type { Product } from "./db.js";

const client = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
});

// Short TTLs keep demo output readable; production values are minutes to hours.
const PRODUCT_TTL = 10; // seconds — single product entry
const LOCK_TTL = 2; // seconds — stampede lock hold time

const productKey = (id: number): string => `product:${id}`;
const lockKey = (id: number): string => `lock:product:${id}`;
const pendingWritesKey = (): string => "pending:writes";

// Product rows carry price as a string already, so JSON round-trips cleanly.
const serialise = (product: Product): string =>
  JSON.stringify({
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
  });
// What comes back out of Redis is a string this process wrote earlier, so
// claiming it is a Product is reasonable — but it is a claim, not a check.
const deserialise = (raw: string): Product => JSON.parse(raw) as Product;

// SET key value NX EX ttl — returns true if the key was set (lock acquired).
async function setNx(key: string, value: string, ttl: number): Promise<boolean> {
  const result = await client.set(key, value, "EX", ttl, "NX");
  return result === "OK";
}

// Release a lock only if we still hold it.
//
// A bare DEL is the classic distributed-lock bug: if our work outran LOCK_TTL the
// lock already expired, someone else acquired it, and DEL deletes *their* lock.
// Comparing the token first fixes that, and the compare-and-delete has to be one
// server-side operation or the same race reopens between the GET and the DEL.
const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

async function releaseLock(key: string, token: string): Promise<boolean> {
  const deleted = await client.eval(RELEASE_LUA, 1, key, token);
  return Number(deleted) === 1;
}

async function printCacheState(label: string, ...keys: string[]): Promise<void> {
  if (!keys.length) return;
  console.log(`\n  [${label}]`);
  for (const key of keys) {
    const raw = await client.get(key);
    if (raw === null) {
      console.log(`    ${JSON.stringify(key).padEnd(35)}  MISS`);
    } else {
      const remaining = await client.ttl(key);
      const ttlStr = remaining >= 0 ? `TTL=${remaining}s` : "no TTL";
      const short = raw.length < 80 ? raw : `${raw.slice(0, 77)}...`;
      console.log(`    ${JSON.stringify(key).padEnd(35)}  HIT  (${ttlStr})  ${short}`);
    }
  }
}

export {
  client,
  PRODUCT_TTL,
  LOCK_TTL,
  productKey,
  lockKey,
  pendingWritesKey,
  serialise,
  deserialise,
  setNx,
  releaseLock,
  printCacheState,
};
