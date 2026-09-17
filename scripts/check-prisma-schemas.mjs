// Guards the two-schema split in the capstone projects.
//
// Prisma requires `provider` to be a literal in the schema file, so an app that
// runs SQLite locally and Postgres in a container needs two schema files. Two
// copies of the same models drift. This compares everything from the first
// `model` keyword onwards and fails if they differ.
//
// Run:  npm run prisma:check   (CI runs it too)

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PAIRS = [
  {
    app: "bookmark-manager",
    sqlite: "backends/bookmark-manager/prisma/schema.prisma",
    postgres: "backends/bookmark-manager/prisma/postgres/schema.prisma",
  },
  {
    app: "url-shortener",
    sqlite: "backends/url-shortener/prisma/schema.prisma",
    postgres: "backends/url-shortener/prisma/postgres/schema.prisma",
  },
];

// The shared part of a schema is everything from the first top-level block that
// isn't `generator` or `datasource` — in practice, the first `model` or `enum`.
function modelBlock(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = /^(model|enum)\s/m.exec(text);
  if (match === null) {
    throw new Error(`${file} contains no model or enum block`);
  }
  return text.slice(match.index).trimEnd();
}

// Report the first differing line rather than dumping both files.
function firstDifference(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) {
      return { line: i + 1, sqlite: left[i] ?? "(end of file)", postgres: right[i] ?? "(end of file)" };
    }
  }
  return null;
}

let failed = false;
for (const { app, sqlite, postgres } of PAIRS) {
  for (const file of [sqlite, postgres]) {
    if (!fs.existsSync(path.resolve(file))) {
      console.error(`${app}: missing ${file}`);
      failed = true;
    }
  }
  if (failed) continue;

  const diff = firstDifference(modelBlock(sqlite), modelBlock(postgres));
  if (diff === null) {
    console.log(`${app}: schemas match`);
    continue;
  }

  failed = true;
  console.error(
    [
      `${app}: the two schemas have drifted, first difference at model-block line ${diff.line}`,
      `  ${sqlite}`,
      `    ${diff.sqlite}`,
      `  ${postgres}`,
      `    ${diff.postgres}`,
      "",
      "  Edit the models in one file, copy the block to the other, then regenerate",
      "  that variant's migration.",
    ].join("\n")
  );
}

process.exit(failed ? 1 : 0);
