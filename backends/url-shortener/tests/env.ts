// Test environment variables.
//
// This lives in its own module for a reason that only bites under ESM. Setting
// DATABASE_URL in setup.ts's body would run too late: `import` statements are
// hoisted and every imported module is evaluated before the importing module's
// own body, so database.ts would already have built its PrismaClient against
// whatever DATABASE_URL happened to be set.
//
// Modules are evaluated in import order, so a bare `import "./env.js"` above the
// app imports gets these assignments in first.
//
// The database file is per Jest worker. Both capstones reset their tables in
// `beforeEach`, so two suites sharing one file would delete each other's rows.
// Jest sets JEST_WORKER_ID (1-based) in every worker; scripts/jest-global-setup.ts
// creates one database per worker before any suite runs. Outside Jest the
// variable is unset and this falls back to worker 1.

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const WORKER_ID = process.env.JEST_WORKER_ID ?? "1";
const DB_PATH = path.resolve(here, "..", "prisma", `test-${WORKER_ID}.db`);
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-not-for-production";
process.env.JWT_EXPIRY_MINUTES = "30";
process.env.BASE_URL = "http://localhost:8000";

export { DB_PATH, WORKER_ID };
