// Root Jest config covering both d-structs-algos and the backends.
//
// The repo is native ESM TypeScript, which pulls in three pieces of setup:
//
//   - @swc/jest strips the types. It is independent of the TypeScript version,
//     so `npm run typecheck` (tsc) and the test run never disagree about tooling.
//   - extensionsToTreatAsEsm + NODE_OPTIONS=--experimental-vm-modules (set in the
//     "test" script) make Jest load the transformed output as real ES modules.
//   - moduleNameMapper undoes the ".js" extension that nodenext requires on
//     relative imports, so "./stack.js" finds stack.ts.
//
// globalSetup builds each capstone's SQLite test database, one copy per Jest
// worker. That per-worker split is what lets this run in parallel: the capstone
// suites reset their tables between tests, so sharing one file across workers
// produced failures that looked random. This used to pin maxWorkers: 1 to dodge
// that, which serialised the seven slowest suites in the repo — about 70% of the
// total test time — to protect two database files.
//
// The databases were not the only thing the workers shared. Each test setup also
// binds a port derived from JEST_WORKER_ID rather than calling listen(0); the
// reasoning, and what is still unproven about it, is in a comment at each of
// them and in LESSONS.md. If this suite ever starts failing intermittently,
// read that before anything else.

import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  globalSetup: "<rootDir>/scripts/jest-global-setup.ts",

  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { target: "es2023", parser: { syntax: "typescript" } },
        module: { type: "es6" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/", "/generated/"],
  modulePathIgnorePatterns: ["<rootDir>/frontends/", "<rootDir>/.history/"],
};

export default config;
