# SNS — Simple Notification Service

SNS is a pub/sub service. A publisher sends a message to a **topic**, and SNS
fans it out to all subscribers simultaneously. Subscribers can be SQS queues,
HTTP endpoints, email, Lambda, and more.

## Key concepts

- **Topic** — a named channel. Publishers send to it; they don't track subscribers.
- **Subscription** — registers a consumer (SQS, email, HTTP, Lambda) on a topic.
- **Fan-out** — the core pattern: one message → many SQS queues in parallel, each
  processed independently.
- **Message filtering** — a subscription's filter policy delivers only messages
  matching certain attributes, so routing logic stays out of the consumer.

## SNS vs SQS

| | SNS | SQS |
|---|---|---|
| Pattern | Pub/sub (push to many) | Queue (pull by one consumer) |
| Delivery | Immediate fan-out | Stored until polled |
| Ordering | No guarantees | FIFO queues: yes |
| Use when | Broadcasting events | Worker queues, rate-limiting, retries |

## What the files cover

| File | What it teaches |
|------|----------------|
| `01_topics.ts` | Create, list, describe, set attributes, delete topics |
| `02_publish.ts` | Publish with subject + message attributes; read the SNS→SQS envelope |
| `03_fan_out.ts` | Fan-out: one topic → three SQS queues with a filter policy |

## How to run

```bash
npx tsx sns/01_topics.ts
npx tsx sns/02_publish.ts
npx tsx sns/03_fan_out.ts
```
