// Test environment variables.
//
// This lives in its own module for a reason that only bites under ESM. The
// CommonJS version of setup.js set process.env and then called require() for the
// app, and `require` runs where it is written. ESM `import` statements do not:
// they are hoisted and every imported module is evaluated before a single line
// of the importing module's body. Setting DATABASE_URL in setup.ts's body would
// therefore run *after* database.ts had already constructed its PrismaClient
// against whatever DATABASE_URL happened to be set.
//
// Modules are evaluated in the order they are imported, so a bare
// `import "./env.js"` placed above the app imports gets these assignments in
// before Prisma reads them.

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.resolve(here, "..", "prisma", "test.db");
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.SECRET_KEY = process.env.SECRET_KEY || "test-secret-key-not-for-production";
process.env.ACCESS_TOKEN_EXPIRE_MINUTES = "30";

export { DB_PATH };
