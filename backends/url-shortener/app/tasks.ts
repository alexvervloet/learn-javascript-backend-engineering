// Background task. `incrementClick` is the worker-side logic; its `.delay()`
// method enqueues a job for the worker to process.

import type { Job } from "bullmq";

import prisma from "./database.js";
import { getClickQueue } from "./queue.js";
import type { ClickJobData } from "./queue.js";

// A function with a property hanging off it needs an interface carrying both a
// call signature and the property, so `incrementClick(code)` and
// `incrementClick.delay(code)` typecheck against one value.
interface ClickTask {
  (shortCode: string): Promise<void>;
  delay: (shortCode: string) => Promise<Job<ClickJobData>>;
}

// Object.assign is what builds that value without an assertion: it returns the
// function type intersected with the properties added to it.
const incrementClick: ClickTask = Object.assign(
  // Worker-side: bump the persisted click counter for a slug.
  async function incrementClick(shortCode: string): Promise<void> {
    await prisma.url.updateMany({
      where: { shortCode },
      data: { clickCount: { increment: 1 } },
    });
  },
  {
    // Enqueue side — `.delay()` adds a click-increment job to the queue.
    delay: async (shortCode: string): Promise<Job<ClickJobData>> =>
      getClickQueue().add("increment", { shortCode }),
  }
);

export { incrementClick };
export type { ClickTask };
