// Network entry point — opens the Redis cache connection at startup
// (`cache.init()`) then listens. Schema is managed by Prisma Migrate: run
// `npx prisma migrate deploy` before starting.

import app from "./main.js";
import * as cache from "./cache.js";
import prisma from "./database.js";

const PORT = Number(process.env.PORT || 8000);

async function main(): Promise<void> {
  await cache.init();
  const server = app.listen(PORT, () => {
    console.log(`URL shortener API listening on port ${PORT}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await cache.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

void main();
