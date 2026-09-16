# SQS — Simple Queue Service

SQS is a managed message queue. Producers push messages; consumers poll and
process them. It decouples services: the producer doesn't care whether the
consumer is running or how fast it processes.

## Key concepts

- **Queue** — a buffer of messages. Two types:
  - **Standard** — at-least-once delivery, best-effort ordering, high throughput.
  - **FIFO** — exactly-once, strict ordering, lower throughput, `.fifo` suffix.
- **Visibility timeout** — after a consumer receives a message it's hidden from
  others for N seconds. If not deleted in time, it reappears (retry). Prevents
  double-processing.
- **Dead letter queue (DLQ)** — a separate queue for messages that fail too many
  times. Keeps poison-pill messages from blocking the queue forever.
- **Long polling** — SQS waits up to 20s for a message instead of returning empty
  immediately, cutting empty responses and API costs.

## What the files cover

| File | What it teaches |
|------|----------------|
| `01_queues.ts` | Create standard and FIFO queues, read attributes, delete |
| `02_messages.ts` | Send, batch-send, receive, delete; visibility-timeout behaviour |
| `03_dead_letter.ts` | Wire a DLQ via redrive policy, simulate failures, inspect stuck messages |

## How to run

```bash
npx tsx sqs/01_queues.ts
npx tsx sqs/02_messages.ts
npx tsx sqs/03_dead_letter.ts
```
