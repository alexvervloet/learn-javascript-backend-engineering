// Shared KafkaJS client. KafkaJS is the standard 2026 Node Kafka client:
// promise-based, with `kafka.producer()`, `kafka.consumer({ groupId })`, and
// `kafka.admin()` factories off a single configured client.

import { Kafka, logLevel } from "kafkajs";

const BOOTSTRAP = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "backend-concepts",
  brokers: [BOOTSTRAP],
  logLevel: logLevel.NOTHING, // quiet the demo output
});

export { kafka, BOOTSTRAP };
