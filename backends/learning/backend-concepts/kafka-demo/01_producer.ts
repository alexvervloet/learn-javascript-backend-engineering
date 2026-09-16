/**
 * Kafka Producer
 * ===============
 * A producer publishes messages to a topic. Kafka appends each to a log on disk
 * and does NOT remove it when consumed — consumers track their position with an
 * offset. Messages are raw bytes; you choose the encoding (JSON here).
 *
 * Key concepts:
 *   producer.send({ topic, messages, acks })  — batches messages to the broker
 *   acks: 0 fire-and-forget · 1 leader ack (default) · -1 all in-sync replicas
 *   a message `key` pins all of its messages to the same partition (ordering)
 *
 * Prerequisites:  docker compose up -d  (wait ~10s)
 * Run:            npx tsx 01_producer.ts
 */

import { kafka } from "./kafka.js";

const TOPIC = "orders";

async function main() {
  console.log("=== Kafka Producer Demo ===\n");
  const producer = kafka.producer({ retry: { retries: 3 } });
  await producer.connect();

  // --- 1. Messages without a key (round-robin across partitions) ---
  console.log("--- 1. Send messages without a key (round-robin) ---");
  for (let i = 1; i <= 5; i += 1) {
    const value = JSON.stringify({ order_id: i, item: `item-${i}`, status: "placed", ts: Date.now() });
    // acks: -1 waits for all in-sync replicas; send returns per-partition metadata.
    const [meta] = await producer.send({ topic: TOPIC, acks: -1, messages: [{ value }] });
    console.log(`  sent order ${i}  → partition=${meta.partition}  offset=${meta.baseOffset}`);
  }

  // --- 2. Messages with a key — same key → same partition ---
  console.log("\n--- 2. Send messages with a key (ordering guarantee) ---");
  for (const customerId of ["cust-A", "cust-A", "cust-B", "cust-A", "cust-B"]) {
    const value = JSON.stringify({ customer: customerId, event: "page_view", ts: Date.now() });
    const [meta] = await producer.send({ topic: TOPIC, messages: [{ key: customerId, value }] });
    console.log(`  customer=${customerId}  → partition=${meta.partition}  offset=${meta.baseOffset}`);
  }

  // --- 3. Batch send — one call, many messages ---
  console.log("\n--- 3. Batch send (one round-trip) ---");
  const batch = Array.from({ length: 5 }, (_, i) => ({ value: JSON.stringify({ batch_item: i, ts: Date.now() }) }));
  await producer.send({ topic: TOPIC, messages: batch });
  console.log(`  sent ${batch.length} messages in one batch`);

  await producer.disconnect();
  console.log(`\nAll messages sent to topic '${TOPIC}'. Run 02_consumer.ts to read them.`);
}

main().catch((err) => {
  console.error("ERROR (is Kafka running? docker compose up -d):", err.message);
  process.exit(1);
});
