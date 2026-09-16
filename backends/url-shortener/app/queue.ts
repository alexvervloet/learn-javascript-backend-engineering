// Background-job infrastructure. BullMQ is a Redis-backed queue with separate
// worker processes. The queue is constructed lazily so importing this module
// never opens a Redis connection on its own.

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

import { getSettings } from "./config.js";

const CLICK_QUEUE = "increment_click";

// The payload every increment_click job carries. Naming it here means the
// worker and the enqueue side cannot drift apart without a compile error.
interface ClickJobData {
  shortCode: string;
}

function redisConnection(): ConnectionOptions {
  const url = new URL(getSettings().redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
  };
}

let clickQueue: Queue<ClickJobData> | null = null;

function getClickQueue(): Queue<ClickJobData> {
  if (clickQueue === null) {
    clickQueue = new Queue<ClickJobData>(CLICK_QUEUE, { connection: redisConnection() });
  }
  return clickQueue;
}

export { CLICK_QUEUE, redisConnection, getClickQueue };
export type { ClickJobData };
