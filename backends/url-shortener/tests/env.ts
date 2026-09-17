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

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.resolve(here, "..", "prisma", "test.db");
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-not-for-production";
process.env.JWT_EXPIRY_MINUTES = "30";
process.env.BASE_URL = "http://localhost:8000";

export { DB_PATH };
