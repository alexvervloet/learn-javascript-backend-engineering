
// Knex configuration. Knex does imperative migrations with explicit up()/down()
// functions and a CLI to apply/roll back. SQLite (better-sqlite3) keeps the demo
// self-contained.

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Knex } from "knex";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// Knex.Config is the library's own config type, so a mistyped option here is a
// compile error rather than a setting that is silently ignored.
const config: Record<string, Knex.Config> = {
  development: {
    client: "better-sqlite3",
    connection: { filename: path.join(here, "library.db") },
    useNullAsDefault: true,
    migrations: { directory: path.join(here, "migrations") },
    seeds: { directory: path.join(here, "seeds") },
  },
};

// The Knex CLI reads the default export of this file.
export default config;
