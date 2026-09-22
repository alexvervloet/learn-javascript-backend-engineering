/**
 * SQL Injection
 * ==============
 * The oldest one, still in the OWASP top ten, and still shipping. The cause is
 * always the same: user input concatenated into a query string, so the database
 * cannot tell your SQL from theirs.
 *
 * The fix is also always the same, and it is not escaping. It is parameters.
 * With a parameterised query the SQL text is fixed before any value is
 * attached, so a value can never become syntax — no amount of quoting in the
 * input changes the shape of the statement.
 *
 * This file runs real exploits against a real (in-memory) SQLite database, then
 * the same inputs against the parameterised version.
 *
 * Run:  npx tsx 02_injection.ts
 */

import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: number;
}

function seed(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id       INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      email    TEXT NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE sessions (id INTEGER PRIMARY KEY, token TEXT NOT NULL);
    INSERT INTO users (username, email, password, is_admin) VALUES
      ('alice', 'alice@example.com', 'hunter2',      0),
      ('bob',   'bob@example.com',   'correct-horse',0),
      ('root',  'root@example.com',  'super-secret', 1);
    INSERT INTO sessions (token) VALUES ('sess_abc123');
  `);
  return db;
}

// ---------------------------------------------------------------------------
// The vulnerable version. This is the bug.
// ---------------------------------------------------------------------------
function findUserUnsafe(db: Database.Database, username: string): User[] {
  // Every injection in this file exists because of this line. The input is part
  // of the SQL text, so the input decides what the SQL means.
  const sql = `SELECT id, username, email, is_admin FROM users WHERE username = '${username}'`;
  return db.prepare(sql).all() as User[];
}

// ---------------------------------------------------------------------------
// The fixed version. One character of difference in the string.
// ---------------------------------------------------------------------------
function findUserSafe(db: Database.Database, username: string): User[] {
  // The `?` is a placeholder the driver fills in separately. The database
  // parses this statement once, with the placeholder in it, and only then
  // receives the value — by which point the shape of the query is settled.
  const sql = `SELECT id, username, email, is_admin FROM users WHERE username = ?`;
  return db.prepare(sql).all(username) as User[];
}

const ATTACKS: { name: string; input: string; what: string }[] = [
  {
    name: "Always true",
    input: "' OR '1'='1",
    what: "turns the WHERE clause into a tautology and returns every row",
  },
  {
    name: "Privilege probe",
    input: "' OR is_admin = 1 --",
    what: "finds the admin accounts; -- comments out the rest of the query",
  },
  {
    name: "UNION exfiltration",
    input: "' UNION SELECT id, token, token, 0 FROM sessions --",
    what: "reads a completely different table through the same endpoint",
  },
];

function demonstrate(): void {
  const db = seed();

  console.log("\n--- Normal use, both versions agree ---");
  console.log(`  unsafe('alice') → ${JSON.stringify(findUserUnsafe(db, "alice").map((u) => u.username))}`);
  console.log(`  safe('alice')   → ${JSON.stringify(findUserSafe(db, "alice").map((u) => u.username))}`);
  console.log("  This is why the bug survives code review and testing.");

  for (const attack of ATTACKS) {
    console.log(`\n--- ${attack.name} ---`);
    console.log(`  input: ${attack.input}`);
    console.log(`  ${attack.what}`);

    const leaked = findUserUnsafe(db, attack.input);
    console.log(`  UNSAFE → ${leaked.length} row(s): ${JSON.stringify(leaked.map((u) => u.username ?? u.email))}`);

    const blocked = findUserSafe(db, attack.input);
    console.log(`  SAFE   → ${blocked.length} row(s) — the input was looked up as a username, which is all it ever was`);
  }

  // The destructive one, kept separate because it changes the database.
  console.log("\n--- Destructive ---");
  console.log("  input: '; DROP TABLE sessions; --");
  console.log("  better-sqlite3's .all() refuses multiple statements, so this");
  console.log("  particular payload fails here. Plenty of drivers allow it, and");
  console.log("  `db.exec()` allows it in this one. Do not read 'my driver");
  console.log("  blocked one payload' as 'my code is safe' — the UNION above");
  console.log("  already read a table it had no business reading.");

  db.close();
}

// ---------------------------------------------------------------------------
// What does not work
// ---------------------------------------------------------------------------
function badFixes(): void {
  console.log("\n--- Fixes that are not fixes ---");
  console.log(`
  Escaping quotes yourself
      input.replace(/'/g, "''") handles the examples above and fails on the
      next one. Numeric contexts need no quotes at all, so WHERE id = \${input}
      is injectable with no quote characters anywhere. Character-level escaping
      is a rule about syntax you do not control.

  Blocklisting keywords
      Rejecting "DROP", "UNION", "--" breaks every user called Drummond and
      stops nobody: SQL has comment syntaxes, encodings and whitespace forms
      you did not think of. Blocklists are a guess about the attacker's
      vocabulary.

  An ORM, automatically
      Prisma and Knex parameterise by default, which is most of why they are
      worth using. Both also expose raw escape hatches, and those are ordinary
      string concatenation again:

          prisma.$queryRawUnsafe(\`SELECT * FROM users WHERE id = \${id}\`)   BAD
          prisma.$queryRaw\`SELECT * FROM users WHERE id = \${id}\`           safe

      The second is a tagged template — Prisma receives the pieces and the
      values separately and parameterises them. The names are a deliberate
      warning: if you typed "Unsafe", you opted in.

  Input validation
      Worth doing, and it is not this. Validation is about whether a value is
      acceptable; parameterisation is about whether it can change the query.
      A perfectly valid username still breaks a concatenated query if it
      contains an apostrophe — ask anyone called O'Brien.
`);

  console.log("  The rule that actually holds: values are parameters, always.");
  console.log("  If a value cannot be a parameter — a table or column name, an");
  console.log("  ORDER BY direction — then it is not a value. Map it through an");
  console.log("  allowlist of literals you wrote:");
  console.log(`
      const SORTABLE = { name: "name", created: "created_at" } as const;
      const column = SORTABLE[req.query.sort] ?? "created_at";
      const dir = req.query.dir === "asc" ? "ASC" : "DESC";
      db.prepare(\`SELECT * FROM posts ORDER BY \${column} \${dir}\`).all();

  That interpolation is safe because the only strings that can reach it are
  ones already in the source.`);
}

function main(): void {
  console.log("=== SQL Injection ===");
  demonstrate();
  badFixes();
  console.log("\nNext: 03_xss.ts");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { findUserUnsafe, findUserSafe, seed };
