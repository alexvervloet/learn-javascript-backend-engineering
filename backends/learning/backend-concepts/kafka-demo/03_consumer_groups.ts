/**
 * Consumer Groups — Work Queue vs Fan-Out
 * =========================================
 * The most important Kafka concept. Consumer groups decide who gets each message.
 *
 *   Work queue (same groupId): Kafka assigns each partition to exactly one
 *     consumer in the group → each message is processed ONCE. Add consumers to
 *     scale horizontally.
 *   Fan-out (different groupIds): every group gets its own copy of every message.
 *     Impossible with a classic queue — Kafka's log lets each group track its own
 *     offset, so fan-out is free.
 *
 * We run consumers concurrently (async) in one process to show both patterns.
 *
 * Prerequisites:  docker compose up -d
 * Run:            npx tsx 03_consumer_groups.ts
 */

import { kafka } from "./kafka.js";

const TOPIC = "events";

// Consume up to `max` messages into `results`, then disconnect.
function runConsumer(
  name: string,
  groupId: string,
  results: string[],
  max: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const consumer = kafka.consumer({ groupId });
    consumer
      .connect()
      .then(() => consumer.subscribe({ topic: TOPIC, fromBeginning: true }))
      .then(() =>
        consumer.run({
          eachMessage: async ({ partition, message }) => {
            results.push(
              `[${name}] partition=${partition} offset=${message.offset}  ${String(message.value)}`
            );
            if (results.length >= max) {
              await consumer.disconnect();
              resolve();
            }
          },
        })
      )
      .catch(reject);
    // Safety stop if fewer messages than expected arrive.
    setTimeout(async () => {
      await consumer.disconnect().catch(() => {});
      resolve();
    }, 5000);
  });
}

async function seed(n: number): Promise<void> {
  const producer = kafka.producer();
  await producer.connect();
  const messages = Array.from({ length: n }, (_, i) => ({ value: JSON.stringify({ event: "order", id: i }) }));
  await producer.send({ topic: TOPIC, messages });
  await producer.disconnect();
}

async function demoWorkQueue() {
  console.log("\n=== WORK QUEUE: same groupId ===");
  console.log("    Two consumers compete; each message is processed once.\n");
  await seed(10);

  const a: string[] = [];
  const b: string[] = [];
  await Promise.all([
    runConsumer("Worker-A", "work-queue-group", a, 10),
    runConsumer("Worker-B", "work-queue-group", b, 10),
  ]);

  console.log(`  Worker-A processed: ${a.length}`);
  console.log(`  Worker-B processed: ${b.length}`);
  console.log(`  Total: ${a.length + b.length} (each message exactly once)`);
}

async function demoFanout() {
  console.log("\n=== FAN-OUT: different groupIds ===");
  console.log("    Two independent services each receive every message.\n");

  const email: string[] = [];
  const analytics: string[] = [];
  await Promise.all([
    runConsumer("EmailService", "email-service", email, 10),
    runConsumer("Analytics", "analytics-service", analytics, 10),
  ]);

  console.log(`  EmailService received: ${email.length}`);
  console.log(`  Analytics received:    ${analytics.length}`);
  console.log("  Both groups got every message independently.");
}

async function main() {
  await demoWorkQueue();
  await demoFanout();
}

main().catch((err) => {
  console.error("ERROR (is Kafka running? docker compose up -d):", err.message);
  process.exit(1);
});
