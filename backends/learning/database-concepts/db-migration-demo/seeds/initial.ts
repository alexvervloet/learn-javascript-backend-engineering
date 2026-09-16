// Knex seed — populate the library with sample data.
// Run after migrations:  npx knex seed:run

import type { Knex } from "knex";

export const seed = async (knex: Knex): Promise<void> => {
  await knex("books").del();
  await knex("authors").del();

  // The email column was added by the second migration, so seed it directly.
  const [leguin, herbert, butler] = await knex("authors")
    .insert([
      { name: "Ursula K. Le Guin", birth_year: 1929, email: "ursula.k.le.guin@example.com" },
      { name: "Frank Herbert", birth_year: 1920, email: "frank.herbert@example.com" },
      { name: "Octavia Butler", birth_year: 1947, email: "octavia.butler@example.com" },
    ])
    .returning("id")
    // .returning("id") gives back either [{id}] or [id] depending on the
    // driver, which is why the original unwrapped both. The cast says that.
    .then((rows: ({ id?: number } | number)[]) =>
      rows.map((r) => (typeof r === "number" ? r : r.id))
    );

  await knex("books").insert([
    { title: "The Left Hand of Darkness", author_id: leguin, published_year: 1969, genre: "Science Fiction", summary: "An envoy visits a planet whose inhabitants have no fixed gender." },
    { title: "The Dispossessed", author_id: leguin, published_year: 1974, genre: "Science Fiction", summary: "A physicist travels between an anarchist moon and the planet it orbits." },
    { title: "Dune", author_id: herbert, published_year: 1965, genre: "Science Fiction", summary: "A noble family is entrusted with the most important planet in the galaxy." },
    { title: "Kindred", author_id: butler, published_year: 1979, genre: "Science Fiction", summary: "A Black woman is repeatedly transported back to the antebellum South." },
    { title: "Parable of the Sower", author_id: butler, published_year: 1993, genre: "Science Fiction", summary: "A young woman survives a collapsing America and builds a new community." },
  ]);

  console.log("Seeded 3 authors and 5 books.");
};
