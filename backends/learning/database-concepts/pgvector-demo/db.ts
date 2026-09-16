// Postgres pool with the pgvector type registered on every connection.
// pgvector/pg teaches node-postgres how to read/write the `vector` type;
// `toSql([...])` formats a JS array as a pgvector literal for parameters.

import { Pool } from "pg";
import pgvector from "pgvector/pg";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "pgvector_demo",
  user: process.env.DB_USER || process.env.USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

// Register the vector type on each new pooled connection.
pool.on("connect", (client) => pgvector.registerTypes(client));

// `export { a: b }` is not valid syntax — an export list renames with `as`,
// and only bindings can appear in it. So toSql gets its own binding first.
const toSql = pgvector.toSql;

export { pool, toSql };
