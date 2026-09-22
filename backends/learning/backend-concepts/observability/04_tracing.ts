/**
 * Distributed Tracing with OpenTelemetry
 * =======================================
 * The third pillar. `03_combined.ts` threaded a UUID through every log line and
 * called it a correlation ID, which answers "which log lines belong to this
 * request?". A trace answers the harder question: where did the time go, and
 * which call caused which.
 *
 * The vocabulary:
 *
 *   Span    — one unit of work with a start, an end, and attributes. An HTTP
 *             handler is a span; so is the database query inside it.
 *   Trace   — a tree of spans sharing a trace id. One request, end to end.
 *   Context  — the plumbing that makes a span know its parent. In Node this is
 *             AsyncLocalStorage, the same mechanism 01 used by hand.
 *   Exporter — where finished spans go: a console, an OTLP collector, Jaeger.
 *
 * What OpenTelemetry buys you over the hand-rolled UUID is two things. Parent
 * and child are recorded, so you get a waterfall rather than a flat list. And
 * the trace id crosses process boundaries automatically: the HTTP
 * instrumentation writes a `traceparent` header on every outbound request and
 * reads it on every inbound one, so service A and service B land in one trace
 * without either one knowing about the other.
 *
 * ---------------------------------------------------------------------------
 * ORDER MATTERS. The SDK has to start before the modules it instruments are
 * imported, because it patches them as they load. That is why the express and
 * http imports below sit *after* sdk.start(), and why a real service usually
 * puts this in its own file loaded with `node --import ./tracing.js`. Import it
 * too late and everything still runs — you just get no spans, which is a
 * miserable thing to debug.
 * ---------------------------------------------------------------------------
 *
 * Run:  npx tsx 04_tracing.ts            (spans printed to the console)
 *       docker compose up -d             (adds Jaeger on :16686)
 *       OTEL_EXPORTER=otlp npx tsx 04_tracing.ts
 *
 *       curl localhost:8000/orders/42
 *       curl localhost:8000/slow
 *       curl localhost:8000/boom
 */

import { fileURLToPath } from "node:url";

import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// The console exporter prints each finished span as JSON, which is noisy but
// needs no infrastructure. Set OTEL_EXPORTER=otlp to send to the Jaeger in
// docker-compose.yml instead and get a real waterfall UI.
const useOtlp = process.env.OTEL_EXPORTER === "otlp";

const sdk = new NodeSDK({
  // Every span carries these. service.name is the one that matters: it is what
  // the UI groups by, and an unset one shows up as "unknown_service:node",
  // which is how most first tracing setups look.
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "observability-demo",
    [ATTR_SERVICE_VERSION]: "1.0.0",
  }),
  traceExporter: useOtlp
    ? new OTLPTraceExporter({ url: "http://localhost:4318/v1/traces" })
    : new ConsoleSpanExporter(),
  // Auto-instrumentation monkey-patches known libraries (http, express, pg,
  // ioredis, and ~40 more) so their spans appear without touching your code.
  // fs is disabled because it fires on every file read and buries the spans you
  // actually wanted.
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();
console.log(`tracing started — exporter: ${useOtlp ? "OTLP → localhost:4318" : "console"}`);

// Imported after sdk.start() on purpose. See the note at the top.
const { default: express } = await import("express");
const { trace, SpanStatusCode } = await import("@opentelemetry/api");

// A tracer is the handle you create manual spans from. The name identifies the
// instrumentation, not the service — convention is the module doing the work.
const tracer = trace.getTracer("observability-demo");

const app = express();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Pretend database work. Wrapped in its own span so the trace shows how much of
// the request was spent here rather than in your own code.
async function fetchOrder(id: string): Promise<{ id: string; item: string }> {
  return tracer.startActiveSpan("db.fetchOrder", async (span) => {
    try {
      // Attributes are the searchable metadata on a span: "show me every trace
      // where order.id was 42". Do not put secrets or PII here — spans are
      // usually readable by anyone with access to the tracing UI.
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("db.operation", "SELECT");
      span.setAttribute("order.id", id);
      await sleep(25);
      return { id, item: "keyboard" };
    } finally {
      // A span that is never ended is never exported. try/finally is the only
      // reliable way to guarantee it, because an exception would otherwise skip
      // the end() call and the span would vanish rather than show up as failed.
      span.end();
    }
  });
}

// A second layer of work, so the waterfall has something to nest.
async function enrich(order: { id: string; item: string }): Promise<object> {
  return tracer.startActiveSpan("enrich.order", async (span) => {
    try {
      await sleep(10);
      return { ...order, price: 49.99 };
    } finally {
      span.end();
    }
  });
}

app.get("/orders/:id", async (req, res) => {
  // No manual span here: the express instrumentation already made one for this
  // route, and the two spans above will nest under it automatically because
  // startActiveSpan reads the current context.
  const order = await fetchOrder(req.params.id);
  const enriched = await enrich(order);

  // The active span is reachable anywhere inside the request, which is how you
  // attach business context to the HTTP span without passing it down the stack.
  trace.getActiveSpan()?.setAttribute("order.item", order.item);

  res.json(enriched);
});

app.get("/slow", async (_req, res) => {
  // Three sequential waits. In the waterfall these are three bars end to end,
  // which is the shape that tells you to parallelise. A flat log line saying
  // "took 450ms" never does.
  await tracer.startActiveSpan("step.one", async (s) => { await sleep(150); s.end(); });
  await tracer.startActiveSpan("step.two", async (s) => { await sleep(150); s.end(); });
  await tracer.startActiveSpan("step.three", async (s) => { await sleep(150); s.end(); });
  res.json({ ok: true });
});

app.get("/boom", async (_req, res) => {
  await tracer.startActiveSpan("risky.work", async (span) => {
    try {
      throw new Error("downstream refused the connection");
    } catch (err) {
      // Two different calls, and both matter. recordException attaches the
      // stack trace as a span event; setStatus is what actually marks the span
      // as failed, which is what the UI filters and alerts on. Recording the
      // exception without setting the status gives you a span that looks fine
      // and happens to have an error attached.
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      res.status(500).json({ error: "something broke — check the trace" });
    } finally {
      span.end();
    }
  });
});

// Traces and logs are only useful together if you can get from one to the
// other. Printing the trace id alongside the request is the cheap version of
// what a real setup does: inject trace_id into every structured log line so a
// slow trace links straight to its logs. `03_combined.ts` used a hand-made UUID
// for this; the trace id replaces it and works across services.
app.use((req, _res, next) => {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId ?? "none";
  console.log(`${req.method} ${req.path}  trace_id=${traceId}`);
  next();
});

function main(): void {
  app.listen(8000, () => {
    console.log("tracing demo on http://localhost:8000");
    console.log("  try: curl localhost:8000/orders/42");
    console.log("       curl localhost:8000/slow");
    console.log("       curl localhost:8000/boom");
    if (useOtlp) console.log("  Jaeger UI: http://localhost:16686");
  });

  // Spans are batched before export, so a process that exits immediately drops
  // whatever is still in the buffer. shutdown() flushes it.
  const stop = (): void => {
    void sdk.shutdown().finally(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { app, fetchOrder, enrich };
