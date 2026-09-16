/**
 * Kafka Consumer
 * ===============
 * A consumer reads from a topic and tracks its position with an *offset*, which
 * Kafka stores per consumer group so it can resume after a restart.
 *
 *   fromBeginning: true  → replay from the first message
 *   fromBeginning: false → only new messages
 *
 * Offset commits:
 *   autoCommit (default)  — Kafka commits periodically; a crash after poll but
 *                           before processing can skip messages.
 *   manual commit         — commit only after successful processing → at-least-once
 *                           delivery (worst case is reprocessing).
 *
 * Prerequisites:  docker compose up -d  +  npx tsx 01_producer.ts
 * Run:            npx tsx 02_consumer.ts
 */

import { kafka } from "./kafka.js";

const TOPIC = "orders";
const GROUP_ID = "demo-consumer-group";

async function main() {
  console.log("=== Kafka Consumer Demo ===\n");
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  console.log(`Consuming topic='${TOPIC}'  group='${GROUP_ID}'\n--- Messages ---`);

  let count = 0;
  // Assigned inside the message handler, so the annotation has to be written
  // out. In Node, setTimeout returns a Timeout object, not a number.
  let idleTimer: NodeJS.Timeout | undefined;
  const stop = async () => {
    await consumer.disconnect();
    console.log(`\nProcessed ${count} messages. Offsets committed — re-running with the`);
    console.log(`same group '${GROUP_ID}' won't re-read them (use a new group to replay).`);
  };

  // autoCommit:false → we commit explicitly after handling each message.
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      const key = message.key ? message.key.toString() : "(no key)";
      console.log(`  partition=${partition}  offset=${String(message.offset).padStart(4)}  key=${key.padEnd(12)}  value=${message.value}`);
      await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
      count += 1;
      // Demo convenience: stop after 3s of no new messages.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(stop, 3000);
    },
  });

  // Kick off the idle timer in case the topic is already empty.
  idleTimer = setTimeout(stop, 3000);
}

main().catch((err) => {
  console.error("ERROR (is Kafka running? docker compose up -d):", err.message);
  process.exit(1);
});
