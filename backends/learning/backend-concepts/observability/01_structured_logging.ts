/**
 * Structured Logging with Pino
 * =============================
 * Plain-text logs are hard to query at scale. Structured logs emit JSON so
 * aggregators (Datadog, Loki, CloudWatch) can index every field.
 *
 *   plain : 2024-01-15 10:23 ERROR Failed to process order 12345 for user 99
 *   json  : {"level":"error","event":"order_failed","order_id":12345,"user_id":99}
 *
 * Pino is the de-facto fast JSON logger for Node. Key concepts:
 *   - child logger  (`logger.child({...})`) = a "bound logger": every line it
 *     emits carries those fields. The parent is unchanged.
 *   - AsyncLocalStorage = async-safe per-request context. Anything logged within
 *     `run(store, fn)` can read the store — the right tool for request_id/user_id
 *     in async handlers.
 *   - pino-pretty = human-readable dev output (vs raw JSON in production).
 *
 * Run:  npx tsx 01_structured_logging.ts
 */

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import pino from "pino";
import type { Logger } from "pino";

// What every log line in a request carries, injected by the mixin below.
interface RequestContext {
  request_id: string;
  user_id: number;
  path: string;
}

// Per-request context store (the contextvars equivalent).
const requestContext = new AsyncLocalStorage<RequestContext>();

function makeLogger({ pretty }: { pretty: boolean }): Logger {
  return pino({
    level: "debug",
    // mixin injects the current request context into every log line.
    mixin: () => requestContext.getStore() ?? {},
    ...(pretty
      ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:SS", ignore: "pid,hostname" } } }
      : {}),
  });
}

// Simulate one HTTP request lifecycle inside its own async context.
async function simulateRequest(
  log: Logger,
  path: string,
  userId: number,
  fail = false
): Promise<void> {
  const store: RequestContext = { request_id: crypto.randomUUID().slice(0, 8), user_id: userId, path };
  await requestContext.run(store, async () => {
    log.info({ event: "request_received" });
    if (fail) {
      log.error({ event: "db_query_failed", table: "orders", error: "connection timeout" });
      log.warn({ event: "request_failed", status: 500 });
    } else {
      log.debug({ event: "db_query", table: "orders", rows_returned: 3, duration_ms: 8 });
      log.info({ event: "request_completed", status: 200, duration_ms: 22 });
    }
  });
}

function demoBoundLogger(log: Logger): void {
  console.log("\n--- 1. Basic logging ---");
  log.info({ event: "server_started", port: 8000, env: "production" });
  log.warn({ event: "high_memory", used_mb: 3800, limit_mb: 4000 });

  console.log("\n--- 2. Child logger: attach context once ---");
  const orderLog = log.child({ order_id: 99123, customer: "alice@example.com" });
  orderLog.info({ event: "payment_initiated", amount: 49.99, currency: "USD" });
  orderLog.info({ event: "payment_captured", provider: "stripe" });
  log.info({ event: "unrelated_event" }); // parent is unaffected

  console.log("\n--- 3. Nested children: add more context later ---");
  const withUser = log.child({ service: "checkout" }).child({ user_id: 42 });
  withUser.info({ event: "cart_submitted", items: 3 });
  withUser.child({ order_id: 99124 }).info({ event: "order_created" });
}

async function demoContext(log: Logger): Promise<void> {
  console.log("\n--- 4. AsyncLocalStorage: async-safe per-request context ---");
  await Promise.all([
    simulateRequest(log, "/api/orders", 1),
    simulateRequest(log, "/api/products", 2),
    simulateRequest(log, "/api/checkout", 3, true),
  ]);
}

async function main(): Promise<void> {
  console.log("=== Structured Logging Demo ===");
  console.log("\n[ Development mode: human-readable output ]");
  const devLog = makeLogger({ pretty: true });
  demoBoundLogger(devLog);
  await demoContext(devLog);

  console.log("\n\n[ Production mode: JSON output ]");
  const prodLog = makeLogger({ pretty: false });
  demoBoundLogger(prodLog);
  await demoContext(prodLog);
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

export { makeLogger, requestContext };
