/**
 * Express Event Producer
 * =======================
 * HTTP requests publish events to Kafka; a separate worker consumes and
 * processes them asynchronously. The API returns 202 Accepted immediately.
 *
 *   Browser ──POST /orders──▶ Express ──▶ Kafka topic "order.placed"
 *                             returns 202                  │
 *                                                          ▼
 *                                                       worker.js (separate process)
 *
 * Why decouple? The request returns fast regardless of processing time; if the
 * worker is down, events queue in Kafka and process on restart; API and workers
 * scale independently; multiple groups can react to the same event.
 *
 * Run:  docker compose up -d  →  npx tsx 05_express.ts  →  (another terminal) npx tsx worker.ts
 *   curl -sX POST localhost:8000/orders -H 'Content-Type: application/json' \
 *     -d '{"item":"keyboard","quantity":2,"customer_id":"cust-42"}'
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";

import { kafka } from "./kafka.js";

const ORDERS_TOPIC = "order.placed";

const app = express();
app.use(express.json());

const producer = kafka.producer({ retry: { retries: 3 } });
let connected = false;

app.post("/orders", async (req, res) => {
  const { item, quantity, customer_id: customerId } = req.body;
  const orderId = crypto.randomUUID().slice(0, 8);
  const event = { order_id: orderId, item, quantity, customer_id: customerId, created_at: Date.now() };

  if (connected) {
    // Key by customer so a customer's events share a partition (stay ordered).
    // No flush — KafkaJS batches for throughput; disconnect on shutdown flushes.
    await producer.send({ topic: ORDERS_TOPIC, acks: -1, messages: [{ key: customerId, value: JSON.stringify(event) }] });
  } else {
    console.log(`[no kafka] would publish: ${JSON.stringify(event)}`);
  }

  res.status(202).json({ order_id: orderId, status: "accepted", message: "Order received. Processing asynchronously." });
});

app.get("/health", (_req, res) => res.json({ status: "ok", kafka_connected: connected }));

async function start() {
  try {
    await producer.connect();
    connected = true;
    console.log("Kafka producer connected.");
  } catch {
    console.log("WARNING: Kafka not available — events will not be published.");
  }
  app.listen(8000, () => console.log("Order API on http://localhost:8000"));
}

// Flush on graceful shutdown.
process.on("SIGINT", async () => {
  if (connected) await producer.disconnect();
  process.exit(0);
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) start();

export { app };
