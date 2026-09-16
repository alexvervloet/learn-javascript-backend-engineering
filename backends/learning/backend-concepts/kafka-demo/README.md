# Kafka

Event streaming with [KafkaJS](https://kafka.js.org). Kafka is a distributed,
append-only commit log: producers append messages to topic partitions, consumers
read by offset, and nothing is deleted on read — which makes fan-out free.

## Stack

- **KafkaJS** producer / consumer / admin clients (`kafka.ts`)
- Kafka broker in KRaft mode via `docker-compose.yml`

## What the files cover

| File | What it teaches |
|---|---|
| `01_producer.ts` | `producer.send`, `acks`, keyed vs unkeyed messages, batch send |
| `02_consumer.ts` | `subscribe` + `run`, `fromBeginning`, manual `commitOffsets` (at-least-once) |
| `03_consumer_groups.ts` | work queue (same group) vs fan-out (different groups) |
| `04_partitions.ts` | admin `createTopics`, key→partition routing, reading one partition |
| `05_express.ts` | HTTP endpoint that publishes events (decoupling pattern) |
| `worker.ts` | Background consumer that processes order events, idempotent, manual commit |

## Run

```bash
docker compose up -d        # Kafka on :9092 (wait ~10s)
npm install                 # from the repo root
npx tsx 01_producer.ts
npx tsx 02_consumer.ts
# event-driven demo:
npx tsx 05_express.ts          # terminal A
npx tsx worker.ts              # terminal B
curl -sX POST localhost:8000/orders -H 'Content-Type: application/json' \
  -d '{"item":"keyboard","quantity":2,"customer_id":"cust-42"}'
```

