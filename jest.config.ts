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
// globalSetup builds each capstone's SQLite test schema once. maxWorkers:1
// runs test files serially so the backend suites can share a single SQLite file
// and reset it between tests without write races (the d-structs-algos suites are
// trivially fast, so serial execution costs nothing meaningful).

import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  globalSetup: "<rootDir>/scripts/jest-global-setup.ts",
  maxWorkers: 1,

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
