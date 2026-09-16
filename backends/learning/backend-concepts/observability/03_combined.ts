/**
 * Combined Observability: Logs + Metrics + Correlation IDs
 * ==========================================================
 * A production-style Express app tying the signals together.
 *
 *   Logs    — what happened (structured JSON via pino)
 *   Metrics — how much / how long (prom-client counters, histograms, gauges)
 *   Traces  — a request's path across services (full tracing needs OpenTelemetry;
 *             the correlation ID here is a lightweight single-service trace)
 *
 * Correlation IDs: each request gets a UUID in middleware that flows into every
 * log line (via AsyncLocalStorage), back to the caller as X-Request-ID, and lets
 * you line up a metric spike with the matching logs. Downstream services forward
 * the same header so one query finds the request's whole journey.
 *
 * Run:  npx tsx 03_combined.ts
 *   curl localhost:8000/orders ; curl localhost:8000/orders/999 ; curl localhost:8000/metrics
 */

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";
import pino from "pino";
import client from "prom-client";

const requestContext = new AsyncLocalStorage();
const log = pino({
  level: "debug",
  mixin: () => requestContext.getStore() ?? {},
  transport: { target: "pino-pretty", options: { translateTime: "HH:MM:SS", ignore: "pid,hostname" } },
});

const registry = new client.Registry();
const requestCount = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "endpoint", "status"],
  registers: [registry],
});
const requestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request duration",
  labelNames: ["method", "endpoint"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
  registers: [registry],
});
const activeRequests = new client.Gauge({ name: "http_active_requests", help: "In-flight requests", registers: [registry] });

const app = express();

// Observability middleware — runs before every request.
app.use((req, res, next) => {
  // Honour a caller-supplied ID for cross-service tracing, or generate one.
  const requestId = req.headers["x-request-id"] || crypto.randomUUID().slice(0, 8);
  res.set("X-Request-ID", requestId);

  requestContext.run({ request_id: requestId, method: req.method, path: req.path }, () => {
    log.info({ event: "request_started" });
    activeRequests.inc();
    const end = requestDuration.startTimer({ method: req.method, endpoint: req.path });

    res.on("finish", () => {
      end();
      activeRequests.dec();
      requestCount.inc({ method: req.method, endpoint: req.path, status: String(res.statusCode) });
      log.info({ event: "request_finished", status: res.statusCode });
    });
    next();
  });
});

interface Order {
  id: number;
  item: string;
  status: string;
}

// Keyed by order id from the URL, so the lookup can miss. Record says that;
// an object literal type would have claimed every id exists.
const ORDERS: Record<string, Order> = {
  1: { id: 1, item: "keyboard", status: "shipped" },
  2: { id: 2, item: "monitor", status: "processing" },
};

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

app.get("/orders", (_req, res) => {
  log.info({ event: "listing_orders", count: Object.keys(ORDERS).length });
  res.json(Object.values(ORDERS));
});

app.get("/orders/:id", (req, res) => {
  const orderId = typeof req.params.id === "string" ? req.params.id : "";
  const order = ORDERS[orderId];
  if (!order) {
    log.warn({ event: "order_not_found", order_id: orderId });
    return res.status(404).json({ detail: `Order ${orderId} not found` });
  }
  log.info({ event: "order_fetched", order_id: order.id, order_status: order.status });
  return res.json(order);
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("observability demo on http://localhost:8000"));
}

export { app, registry };
