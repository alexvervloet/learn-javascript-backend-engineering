// Background-job infrastructure. BullMQ is a Redis-backed queue with separate
// worker processes. The queue is constructed lazily so that importing this
// module (e.g. in tests, which stub the enqueue side) never opens a Redis
// connection.

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

import { getSettings } from "./config.js";

const METADATA_QUEUE = "bookmark_metadata";
const CLICK_FLUSH_QUEUE = "bookmark_click_flush";

// The payload a metadata job carries. Naming it keeps the enqueue side and the
// worker from drifting apart without a compile error.
interface MetadataJobData {
  bookmarkId: number;
  url: string;
}

function redisConnection(): ConnectionOptions {
  const url = new URL(getSettings().brokerUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
  };
}

let metadataQueue: Queue<MetadataJobData> | null = null;

function getMetadataQueue(): Queue<MetadataJobData> {
  if (metadataQueue === null) {
    metadataQueue = new Queue<MetadataJobData>(METADATA_QUEUE, {
      connection: redisConnection(),
    });
  }
  return metadataQueue;
}

export {
  METADATA_QUEUE,
  CLICK_FLUSH_QUEUE,
  redisConnection,
  getMetadataQueue,
};
export type { MetadataJobData };
