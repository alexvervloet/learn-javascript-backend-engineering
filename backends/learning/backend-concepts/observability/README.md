# Observability

The three pillars — logs, metrics, traces — with [`pino`](https://getpino.io)
(structured JSON logging), [`prom-client`](https://github.com/siimon/prom-client)
(Prometheus metrics), and Express.

| File | What it teaches |
|---|---|
| `01_structured_logging.ts` | Pino JSON logs, child loggers (bound context), AsyncLocalStorage per-request context, pretty dev output |
| `02_metrics.ts` | prom-client Counter/Histogram/Gauge + middleware + `/metrics` |
| `03_combined.ts` | Correlation IDs threaded through logs + metrics, `X-Request-ID` |

`prometheus.yml` + `docker-compose.yml` run Prometheus (:9090) and Grafana (:3000).

## Run

```bash
npm install                 # from the repo root (pino, pino-pretty, prom-client)
npx tsx 01_structured_logging.ts
npx tsx 03_combined.ts         # Express app on :8000
docker compose up -d        # Prometheus + Grafana (scrapes host:8000/metrics)
```

