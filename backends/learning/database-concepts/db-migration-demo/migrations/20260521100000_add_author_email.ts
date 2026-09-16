// A schema change WITH a data migration. up() adds a column, then backfills
// existing rows in the same migration; down() drops the column.

import type { Knex } from "knex";

// The rows this migration reads back to build the placeholder addresses.
interface AuthorRow {
  id: number;
  name: string;
}

export const up = async (knex: Knex): Promise<void> => {
  await knex.schema.alterTable("authors", (t) => t.string("email", 200));

  // Data migration: derive a placeholder email for every existing author.
  // Running this inside the migration keeps schema + data changes atomic.
  const authors = await knex<AuthorRow>("authors").select("id", "name");
  for (const a of authors) {
    const email = `${a.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
    // eslint-disable-next-line no-await-in-loop
    await knex("authors").where({ id: a.id }).update({ email });
  }
};

export const down = async (knex: Knex): Promise<void> =>
  knex.schema.alterTable("authors", (t) => t.dropColumn("email"));
