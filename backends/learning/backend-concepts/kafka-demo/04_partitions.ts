/**
 * Partitions and Message Keys
 * =============================
 * A topic is split into partitions for parallelism. Each partition is an ordered
 * append-only log; ordering is guaranteed *within* a partition, not across them.
 *
 * Routing:
 *   no key   → round-robin across partitions
 *   with key → hash(key) % numPartitions → deterministic, so a key's messages
 *              always land on the same partition (and stay ordered)
 *
 * Rule of thumb: key = the entity whose events must be ordered (user_id,
 * order_id, …). Parallelism is bounded by partition count: a 3-partition topic
 * supports at most 3 working consumers per group.
 *
 * Prerequisites:  docker compose up -d
 * Run:            npx tsx 04_partitions.ts
 */

import { kafka } from "./kafka.js";

const TOPIC = "user-events";
const NUM_PARTITIONS = 3;

async function ensureTopic() {
  const admin = kafka.admin();
  await admin.connect();
  const created = await admin.createTopics({
    topics: [{ topic: TOPIC, numPartitions: NUM_PARTITIONS, replicationFactor: 1 }],
  });
  console.log(created ? `  Created topic '${TOPIC}' with ${NUM_PARTITIONS} partitions` : `  Topic '${TOPIC}' already exists`);
  await admin.disconnect();
}

async function main() {
  console.log("=== Kafka Partitions and Message Keys ===\n");
  await ensureTopic();

  const producer = kafka.producer();
  await producer.connect();

  // --- 1. Keyed messages: same key → same partition ---
  console.log("\n--- 1. Keyed messages: same key → same partition ---");
  const events = [
    ["user-A", { event: "login", user: "A" }],
    ["user-B", { event: "login", user: "B" }],
    ["user-A", { event: "add_to_cart", user: "A" }],
    ["user-C", { event: "login", user: "C" }],
    ["user-B", { event: "purchase", user: "B" }],
    ["user-A", { event: "checkout", user: "A" }],
    ["user-C", { event: "add_to_cart", user: "C" }],
  ];
  const byKey = new Map<string, Set<number>>();
  // events is inferred as (string | object)[][] without the annotation, which
  // is why the destructured key and value below need it spelled out.
  for (const [key, value] of events as [string, Record<string, string>][]) {
    const [meta] = await producer.send({ topic: TOPIC, messages: [{ key, value: JSON.stringify(value) }] });
    console.log(`  key=${key.padEnd(8)}  → partition=${meta.partition}  offset=${meta.baseOffset}`);
    byKey.set(key, (byKey.get(key) ?? new Set()).add(meta.partition));
  }
  console.log("\n  Summary: each key consistently maps to one partition");
  for (const [key, partitions] of [...byKey].sort()) {
    console.log(`    ${key}: partitions used = {${[...partitions].join(", ")}}`);
  }

  // --- 2. Unkeyed messages: round-robin ---
  console.log("\n--- 2. Unkeyed messages: round-robin (no ordering guarantee) ---");
  for (let i = 0; i < 6; i += 1) {
    const [meta] = await producer.send({ topic: TOPIC, messages: [{ value: JSON.stringify({ event: "anonymous_action", seq: i }) }] });
    console.log(`  seq=${i}  → partition=${meta.partition}  offset=${meta.baseOffset}`);
  }
  await producer.disconnect();

  // --- 3. Consuming from a specific partition ---
  console.log("\n--- 3. Consuming directly from partition 0 ---");
  const consumer = kafka.consumer({ groupId: `inspect-${Date.now()}` });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  let n = 0;
  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      if (partition !== 0) return;
      n += 1;
      const key = message.key ? message.key.toString() : "(none)";
      console.log(`    offset=${message.offset}  key=${key.padEnd(10)}  value=${message.value}`);
    },
  });
  setTimeout(async () => {
    await consumer.disconnect();
    console.log(`  Partition 0 contained ${n} message(s).`);
  }, 2500);
}

main().catch((err) => {
  console.error("ERROR (is Kafka running? docker compose up -d):", err.message);
  process.exit(1);
});
