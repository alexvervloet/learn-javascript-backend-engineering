// Jest globalSetup — builds each capstone's SQLite test database before any suite
// runs, one copy per Jest worker.
//
// Why a copy per worker. Both capstones reset their tables in `beforeEach`, so two
// suites sharing one database file delete each other's rows and fail in ways that
// look random. That used to be handled by pinning `maxWorkers: 1` and running
// every file serially, which is a heavy price: the seven capstone suites are about
// 70% of the total test time, and they were the ones being serialised.
//
// Giving each worker its own file removes the contention instead of avoiding it.
// Jest sets JEST_WORKER_ID (1-based) in every worker process, and each app's
// tests/env.ts builds its DATABASE_URL from it.
//
// `prisma db push` shells out to npx and takes a second or so, so it runs once per
// app into a template and the per-worker files are copied from that. Copying a
// SQLite database is copying one file.

import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Config } from "@jest/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..");

const APPS = ["bookmark-manager", "url-shortener"];

// Kept in step with testDbPath() in each app's tests/env.ts.
function workerDbPath(prismaDir: string, workerId: number): string {
  return path.join(prismaDir, `test-${workerId}.db`);
}

export default async function globalSetup(globalConfig: Config.GlobalConfig): Promise<void> {
  // maxWorkers is what Jest will actually use for this run, so `--maxWorkers=2`
  // or `--runInBand` produces exactly the number of databases needed.
  const workers = Math.max(1, globalConfig.maxWorkers);

  for (const app of APPS) {
    const projectRoot = path.join(REPO_ROOT, "backends", app);
    const prismaDir = path.join(projectRoot, "prisma");
    const schema = path.join(prismaDir, "schema.prisma");
    const template = path.join(prismaDir, "test-template.db");

    // Clear out anything left by an earlier run, including the single test.db
    // this used to use and any databases for workers we no longer need.
    for (const entry of fs.readdirSync(prismaDir)) {
      if (/^test(-\w+)?\.db(-journal|-wal|-shm)?$/.test(entry)) {
        fs.rmSync(path.join(prismaDir, entry), { force: true });
      }
    }

    execFileSync(
      "npx",
      ["prisma", "db", "push", `--schema=${schema}`, "--skip-generate", "--accept-data-loss"],
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL: `file:${template}` },
        stdio: "ignore",
      }
    );

    for (let worker = 1; worker <= workers; worker += 1) {
      fs.copyFileSync(template, workerDbPath(prismaDir, worker));
    }
    fs.rmSync(template, { force: true });
  }
}

export { workerDbPath };
