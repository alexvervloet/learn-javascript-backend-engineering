# Webhooks

A webhook is an HTTP POST one service sends another when an event happens. These
demos use Express, Node's built-in `fetch`, and `node:crypto` (no extra deps).

| File | What it teaches |
|---|---|
| `01_receiver.ts` | Accept the POST, return 2xx fast, process async |
| `02_sender.ts` | Register URLs, POST events to all of them, fire-and-forget |
| `03_signing.ts` | HMAC-SHA256 signatures, replay protection, constant-time compare |
| `04_reliability.ts` | Retries with exponential backoff + receiver idempotency |

## Run

```bash
npm install                 # from the repo root (express)
npx tsx 03_signing.ts          # standalone crypto demo

npx tsx 01_receiver.ts         # terminal A (:8001)
npx tsx 02_sender.ts           # terminal B (:8000)
curl -X POST 'localhost:8000/webhooks/register?url=http://localhost:8001/webhook'
curl -X POST 'localhost:8000/orders?item=keyboard'
curl localhost:8001/events
```

