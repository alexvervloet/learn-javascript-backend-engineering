# Observability

The three pillars — logs, metrics, traces — with [`pino`](https://getpino.io)
(structured JSON logging), [`prom-client`](https://github.com/siimon/prom-client)
(Prometheus metrics), [OpenTelemetry](https://opentelemetry.io) (traces), and
Express.

| File | What it teaches |
|---|---|
| `01_structured_logging.ts` | Pino JSON logs, child loggers (bound context), AsyncLocalStorage per-request context, pretty dev output |
| `02_metrics.ts` | prom-client Counter/Histogram/Gauge + middleware + `/metrics` |
| `03_combined.ts` | Correlation IDs threaded through logs + metrics, `X-Request-ID` |
| `04_tracing.ts` | OpenTelemetry spans, auto-instrumentation, nested manual spans, error status, OTLP export to Jaeger |

`prometheus.yml` + `docker-compose.yml` run Prometheus (:9090), Grafana (:3000)
and Jaeger (:16686).

## Which pillar answers which question

Each one is good at something the other two are bad at, which is why you end up
running all three rather than picking a favourite.

| | Answers | Bad at |
|---|---|---|
| Logs | What exactly happened in this one request | Aggregation — "how often" means grepping |
| Metrics | How much, how many, how long, across everything | Any individual request; a p99 spike names no culprit |
| Traces | Where the time went, and which call caused which | Volume and cost — traces are usually sampled |

The move from `03` to `04` is the one worth understanding. `03` puts a UUID on
every log line so you can grep one request out of the pile. That is a real
technique and it stops at the process boundary. A trace records parent and child
and propagates its id over HTTP headers, so the same request through four
services is one waterfall instead of four greps you have to line up by
timestamp.

## Run

```bash
npm install                 # from the repo root (pino, pino-pretty, prom-client, @opentelemetry/*)

npx tsx 01_structured_logging.ts  # prints and exits
npx tsx 02_metrics.ts             # server on :8000, metrics at /metrics
npx tsx 03_combined.ts            # server on :8000, logs + metrics + request ids
npx tsx 04_tracing.ts             # server on :8000, spans printed to the console

docker compose up -d              # Prometheus + Grafana + Jaeger
```

`02`, `03` and `04` all bind port 8000, so run one at a time. Prometheus scrapes
whichever one is up.

### Seeing a real waterfall

The console exporter prints spans as JSON, which is enough to prove the nesting
is right and miserable to read. Point it at Jaeger instead:

```bash
docker compose up -d
OTEL_EXPORTER=otlp npx tsx 04_tracing.ts

curl localhost:8000/orders/42    # nested spans: route -> db -> enrich
curl localhost:8000/slow         # three sequential steps, the classic waterfall
curl localhost:8000/boom         # a span marked failed, with the exception attached
```

Then open <http://localhost:16686>, pick `observability-demo` and hit Find
Traces. `/slow` is the one to look at first: three bars end to end is the shape
that tells you the work could have been done in parallel, and no log line or
latency histogram will ever tell you that.

## The one that catches everyone

The SDK patches libraries as they are imported, so it has to start **before**
the thing it instruments is loaded. `04_tracing.ts` imports `express` with a
dynamic `import()` after `sdk.start()` for exactly this reason. Get the order
wrong and nothing errors — the app runs normally and produces no spans, which is
a genuinely unpleasant thing to debug.

In a real service you avoid the problem by putting the SDK setup in its own file
and loading it ahead of everything else:

```bash
node --import ./tracing.js ./server.js
```
