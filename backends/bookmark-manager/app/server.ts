// Network entry point — imports the app factory and starts listening.
// Schema is managed by Prisma Migrate: `npx prisma migrate deploy` before start.

import app from "./main.js";
import { makeLogger } from "./logging_config.js";

const logger = makeLogger("app.server");
const PORT = Number(process.env.PORT || 8000);

app.listen(PORT, () => {
  logger.info(`Bookmark manager API listening on port ${PORT}`);
});
