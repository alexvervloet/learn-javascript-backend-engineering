// Background tasks.
//
// `fetchBookmarkMetadata` is the worker-side logic; its `.delay()` method
// enqueues a job. Tests stub `.delay` so no broker is needed.
// `flushBookmarkClicks` is the write-behind flush, called directly by tests and
// by the scheduled worker.

import type { Job } from "bullmq";

import prisma from "./database.js";
import { getMetadataQueue } from "./queue.js";
import type { MetadataJobData } from "./queue.js";
import { getRedis } from "./redis_client.js";
import { makeLogger } from "./logging_config.js";

const logger = makeLogger("app.tasks");

const TITLE_PATTERN = /<title[^>]*>(.*?)<\/title>/is;
const CLICK_KEY_PREFIX = "bookmark_clicks:";

// A function with a property hanging off it needs an interface carrying both a
// call signature and the property. Object.assign below builds a value of that
// shape without an assertion.
interface MetadataTask {
  (bookmarkId: number, url: string): Promise<void>;
  delay: (bookmarkId: number, url: string) => Promise<Job<MetadataJobData>>;
}

// Fetch the <title> at `url` and overwrite the bookmark's title if it's still
// the URL.
const fetchBookmarkMetadata: MetadataTask = Object.assign(
  async function fetchBookmarkMetadata(bookmarkId: number, url: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "BookmarkManager/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Network error — BullMQ retries are configured on the worker, so here we
      // just give up on this attempt.
      return;
    }

    if (!response.ok) {
      logger.warning(`HTTP ${response.status} fetching metadata for bookmark ${bookmarkId}`);
      return;
    }

    const body = await response.text();
    const match = TITLE_PATTERN.exec(body);
    // match[1] is the capture group. It is typed as possibly absent because a
    // regex can match without the group participating.
    const captured = match?.[1];
    if (captured === undefined) {
      logger.info(`No <title> found for bookmark ${bookmarkId} (${url})`);
      return;
    }

    const title = captured.trim().slice(0, 300);
    const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
    if (bookmark && bookmark.title === bookmark.url) {
      await prisma.bookmark.update({ where: { id: bookmarkId }, data: { title } });
      logger.info(`Updated bookmark ${bookmarkId} with title: ${title}`);
    }
  },
  {
    // Enqueue side — `.delay()` adds a job to the queue for the worker to pick up.
    delay: async (bookmarkId: number, url: string): Promise<Job<MetadataJobData>> =>
      getMetadataQueue().add("fetch", { bookmarkId, url }),
  }
);

// Read and remove every `bookmark_clicks:*` counter atomically, returning the
// pending counts so SCAN + GETDEL can't drop clicks that arrive mid-scan.
async function drainClickCounters(): Promise<Map<number, number>> {
  const redis = getRedis();
  const pending = new Map<number, number>();
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${CLICK_KEY_PREFIX}*`,
      "COUNT",
      100
    );
    cursor = next;
    for (const key of keys) {
      const value = await redis.getdel(key);
      if (value === null) continue;
      const idPart = key.split(":")[1];
      const bookmarkId = Number.parseInt(idPart ?? "", 10);
      const count = Number.parseInt(value, 10);
      if (Number.isNaN(bookmarkId) || Number.isNaN(count)) {
        logger.warning(`Skipping malformed click key: ${key}`);
        continue;
      }
      if (count > 0) pending.set(bookmarkId, count);
    }
  } while (cursor !== "0");
  return pending;
}

interface FlushResult {
  flushed: number;
  bookmarks: number;
}

// Drain `bookmark_clicks:*` counters from Redis and apply them to the DB.
// Scheduled every 10 minutes by the worker. This is the write-behind flush.
async function flushBookmarkClicks(): Promise<FlushResult> {
  const pending = await drainClickCounters();

  if (pending.size === 0) {
    logger.info("flushBookmarkClicks: nothing to flush");
    return { flushed: 0, bookmarks: 0 };
  }

  let total = 0;
  for (const [bookmarkId, count] of pending) {
    const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
    if (bookmark === null) {
      logger.warning(`Bookmark ${bookmarkId} no longer exists; dropping ${count} clicks`);
      continue;
    }
    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: { clickCount: bookmark.clickCount + count },
    });
    total += count;
  }

  logger.info(`flushBookmarkClicks: applied ${total} clicks across ${pending.size} bookmarks`);
  return { flushed: total, bookmarks: pending.size };
}

export { fetchBookmarkMetadata, flushBookmarkClicks, CLICK_KEY_PREFIX };
export type { MetadataTask, FlushResult };
