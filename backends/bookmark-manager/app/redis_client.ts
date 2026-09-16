// Lazy Redis client used by the JWT blocklist and the click counter.
//
// A module-level singleton with getRedis() / setRedis() lets tests swap in
// ioredis-mock without monkey-patching every import site.

import { Redis } from "ioredis";

import { getSettings } from "./config.js";

let client: Redis | null = null;

function getRedis(): Redis {
  if (client === null) {
    const settings = getSettings();
    client = new Redis(settings.redisUrl);
  }
  return client;
}

// For testing: inject a fake Redis client.
function setRedis(injected: Redis): void {
  client = injected;
}

export { getRedis, setRedis };
