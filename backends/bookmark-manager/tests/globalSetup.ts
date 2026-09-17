// Jest globalSetup — creates the SQLite test schema once before the suite runs.
// It runs `prisma db push` against a throwaway test.db so every test worker can
// open it.
//
// The path is fixed, so two `npm test` runs at once will fight over the same
// file: the second one's db push deletes the database the first is mid-query on,
// and you get a scatter of unrelated failures that look like a flaky suite. One
// run at a time.

import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ROOT = path.resolve(here, "..");
const SCHEMA = path.join(PROJECT_ROOT, "prisma", "schema.prisma");
const DB_PATH = path.join(PROJECT_ROOT, "prisma", "test.db");

export default async function globalSetup(): Promise<void> {
  fs.rmSync(DB_PATH, { force: true });
  execFileSync(
    "npx",
    ["prisma", "db", "push", `--schema=${SCHEMA}`, "--skip-generate", "--accept-data-loss"],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
      stdio: "ignore",
    }
  );
}
