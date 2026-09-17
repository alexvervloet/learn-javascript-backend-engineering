// Jest globalSetup — creates each capstone's SQLite test schema once, before any
// suite runs. `prisma db push` writes a throwaway test.db per app.
//
// Jest allows exactly one globalSetup, so both apps are handled here rather than
// each owning its own. It used to live in backends/bookmark-manager/tests/ and
// only covered that app.
//
// The paths are fixed, so two `npm test` runs at once will fight over the same
// files: the second one's db push deletes the database the first is mid-query
// on, and you get a scatter of unrelated failures that look like a flaky suite.
// One run at a time.

import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..");

const APPS = ["bookmark-manager", "url-shortener"];

export default async function globalSetup(): Promise<void> {
  for (const app of APPS) {
    const projectRoot = path.join(REPO_ROOT, "backends", app);
    const schema = path.join(projectRoot, "prisma", "schema.prisma");
    const dbPath = path.join(projectRoot, "prisma", "test.db");

    fs.rmSync(dbPath, { force: true });
    execFileSync(
      "npx",
      ["prisma", "db", "push", `--schema=${schema}`, "--skip-generate", "--accept-data-loss"],
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        stdio: "ignore",
      }
    );
  }
}
