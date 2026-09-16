// Background worker — processes click-increment jobs off the BullMQ queue.

import { Worker } from "bullmq";
import type { Job } from "bullmq";

import { CLICK_QUEUE, redisConnection } from "./queue.js";
import type { ClickJobData } from "./queue.js";
import { incrementClick } from "./tasks.js";

const worker = new Worker<ClickJobData>(
  CLICK_QUEUE,
  async (job: Job<ClickJobData>) => incrementClick(job.data.shortCode),
  { connection: redisConnection(), concurrency: 4 }
);

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

console.log("URL shortener worker started");
