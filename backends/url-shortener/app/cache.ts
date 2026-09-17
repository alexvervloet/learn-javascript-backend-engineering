// Redis cache helpers for the hot redirect path. `init()` is called once at
// startup; the rest assume a connection exists.

// ioredis is a CommonJS package whose class is both the default and a named
// export. Under nodenext the default import resolves to the module namespace,
// which is not constructable, so take the named one.
import { Redis } from "ioredis";

import { getSettings } from "./config.js";

const KEY_PREFIX = "url:";

let redis: Redis | null = null;

async function init(): Promise<void> {
  redis = new Redis(getSettings().redisUrl);
}

// Swap the client out. Tests use this to install an in-memory fake instead of
// calling init() and opening a real connection; the bookmark-manager app has the
// same seam. Nothing in the running application calls it.
function setRedis(client: Redis): void {
  redis = client;
}

async function close(): Promise<void> {
  if (redis) await redis.quit();
}

function key(shortCode: string): string {
  return `${KEY_PREFIX}${shortCode}`;
}

// The module-level client starts as null and is filled in by init(), so every
// read went through an implicit "it's there by now" assumption in the JS
// version. This states the assumption once and names what went wrong when it
// does not hold.
function connection(): Redis {
  if (redis === null) {
    throw new Error("Redis cache used before cache.init() was called");
  }
  return redis;
}

async function get(shortCode: string): Promise<string | null> {
  return connection().get(key(shortCode));
}

async function set(shortCode: string, originalUrl: string): Promise<void> {
  await connection().set(key(shortCode), originalUrl, "EX", getSettings().cacheTtl);
}

async function invalidate(shortCode: string): Promise<void> {
  await connection().del(key(shortCode));
}

interface CacheStats {
  keyspace_hits: number | null;
  keyspace_misses: number | null;
}

async function stats(): Promise<CacheStats> {
  const info = await connection().info("stats");
  const read = (field: string): number | null => {
    const match = new RegExp(`${field}:(\\d+)`).exec(info);
    return match?.[1] !== undefined ? Number(match[1]) : null;
  };
  return {
    keyspace_hits: read("keyspace_hits"),
    keyspace_misses: read("keyspace_misses"),
  };
}

export { init, setRedis, close, get, set, invalidate, stats };
export type { CacheStats };
