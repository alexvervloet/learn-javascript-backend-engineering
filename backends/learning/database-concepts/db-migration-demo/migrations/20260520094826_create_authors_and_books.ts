// Initial schema — the first migration revision.
// up() builds the schema; down() reverses it (drop in FK-safe order).
//
// Knex's own Knex type annotates the argument, so the table-builder callbacks
// below get their methods checked: a mistyped column helper is a compile error
// rather than a migration that fails halfway through against a real database.

import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> =>
  knex.schema
    .createTable("authors", (t) => {
      t.increments("id").primary();
      t.string("name", 100).notNullable();
      t.integer("birth_year");
    })
    .createTable("books", (t) => {
      t.increments("id").primary();
      t.string("title", 200).notNullable();
      t.integer("author_id").notNullable().references("id").inTable("authors");
      t.integer("published_year");
      t.string("genre", 50);
      t.text("summary");
    });

export const down = async (knex: Knex): Promise<void> =>
  knex.schema.dropTableIfExists("books").dropTableIfExists("authors");
