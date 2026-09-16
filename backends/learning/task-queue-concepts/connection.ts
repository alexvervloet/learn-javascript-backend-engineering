// Shared Redis connection config.
//
// Every concept file imports `connection` from here so they all talk to the
// same Redis instance. BullMQ is a Redis-backed queue with worker processes;
// there is no separate "result backend" — it stores job state and return values
// in the same Redis under per-queue keys.
//
//   Producer (queue.add)  →  Redis (queue)  →  Worker (processor)  →  Redis (job result)
//
// BullMQ requires `maxRetriesPerRequest: null` on the ioredis connection it
// uses for blocking commands; passing a plain options object lets BullMQ create
// and tune the connection itself.

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
};

export { connection };
