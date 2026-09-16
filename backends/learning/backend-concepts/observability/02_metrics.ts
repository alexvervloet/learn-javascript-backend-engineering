/**
 * Prometheus Metrics
 * ===================
 * Prometheus scrapes an HTTP /metrics endpoint on a schedule and stores
 * time-series data; Grafana queries it for dashboards. In Node the standard
 * client is `prom-client`.
 *
 * Metric types:
 *   Counter   — only goes up (total requests/errors). Query: rate(counter[5m]).
 *   Histogram — buckets observations; exposes _bucket/_sum/_count. Query:
 *               histogram_quantile(0.95, rate(*_bucket[5m])) → p95 latency.
 *   Gauge     — current value, up or down (active connections, queue depth).
 *
 * Labels slice a metric (method/endpoint/status). Keep cardinality low — never
 * use user IDs/UUIDs as labels.
 *
 * Run:  npx tsx 02_metrics.ts
 *   curl localhost:8000/metrics   curl localhost:8000/slow   curl localhost:8000/error
 */

import { fileURLToPath } from "node:url";

import express from "express";
import client from "prom-client";

const app = express();

// A registry holds all metrics; collectDefaultMetrics adds process/GC stats.
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const requestCount = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "endpoint", "status"],
  registers: [registry],
});

const requestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "endpoint"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
  registers: [registry],
});

const activeRequests = new client.Gauge({
  name: "http_active_requests",
  help: "Requests currently being processed",
  registers: [registry],
});

const errorCount = new client.Counter({
  name: "http_errors_total",
  help: "Total HTTP errors (4xx/5xx)",
  labelNames: ["method", "endpoint", "status"],
  registers: [registry],
});

// Middleware records metrics for every request automatically.
app.use((req, res, next) => {
  const endpoint = req.path;
  activeRequests.inc();
  const end = requestDuration.startTimer({ method: req.method, endpoint });

  res.on("finish", () => {
    const status = String(res.statusCode);
    end();
    activeRequests.dec();
    requestCount.inc({ method: req.method, endpoint, status });
    if ((status.startsWith("4") || status.startsWith("5")) && status !== "404") {
      errorCount.inc({ method: req.method, endpoint, status });
    }
  });
  next();
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

app.get("/", (_req, res) => res.json({ status: "ok" }));
app.get("/fast", async (_req, res) => {
  await sleep(Math.random() * 4 + 1);
  res.json({ latency: "low" });
});
app.get("/slow", async (_req, res) => {
  await sleep(Math.random() * 1000 + 500);
  res.json({ latency: "high" });
});
app.get("/error", (_req, res) => res.status(500).send("simulated error"));
app.get("/random", async (_req, res) => {
  await sleep(Math.random() * 300 + 10);
  if (Math.random() < 0.1) return res.status(500).send("random error");
  return res.json({ value: Math.floor(Math.random() * 100) + 1 });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("metrics app on http://localhost:8000 (/metrics)"));
}

export { app, registry };
