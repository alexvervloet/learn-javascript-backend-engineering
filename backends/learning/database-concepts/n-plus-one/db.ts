// Postgres helper + query counter for the N+1 demos.
//
// ORMs (Prisma, Drizzle) hide query counts behind lazy-loaded relations, which
// is how N+1 sneaks in. Here we use raw `pg` and a counting wrapper so every
// round-trip is explicit — exactly the thing N+1 makes easy to lose track of.

import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

// The rows this demo's schema produces.
interface Author {
  id: number;
  name: string;
  birth_year: number;
}

interface Book {
  id: number;
  title: string;
  author_id: number;
  genre: string;
}

interface Tag {
  id: number;
  name: string;
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "n_plus_one_demo",
  user: process.env.DB_USER || process.env.USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

let log: string[] | null = null; // when set, every query is recorded here

// Generic over the row type, so a caller says what a query returns at the call
// site — pg cannot know from the SQL string.
async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (log) log.push(sql.replace(/\s+/g, " ").trim());
  return pool.query<T>(sql, params);
}

// Count + report every query fired inside fn (the query_log context manager).
async function withQueryLog(
  fn: () => Promise<void>,
  { showSql = false }: { showSql?: boolean } = {}
): Promise<string[]> {
  log = [];
  try {
    await fn();
  } finally {
    const queries = log;
    log = null;
    console.log(`  → ${queries.length} quer${queries.length === 1 ? "y" : "ies"} fired`);
    if (showSql) queries.forEach((q, i) => console.log(`     [${i + 1}] ${q.slice(0, 200)}`));
    console.log();
    return queries; // eslint-disable-line no-unsafe-finally
  }
}

const close = (): Promise<void> => pool.end();

async function setup(): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS book_tags;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS tags;
    DROP TABLE IF EXISTS authors;
    CREATE TABLE authors (id SERIAL PRIMARY KEY, name TEXT NOT NULL, birth_year INT NOT NULL);
    CREATE TABLE books (id SERIAL PRIMARY KEY, title TEXT NOT NULL,
      author_id INT NOT NULL REFERENCES authors(id), genre TEXT NOT NULL);
    CREATE TABLE tags (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE book_tags (book_id INT REFERENCES books(id), tag_id INT REFERENCES tags(id), PRIMARY KEY (book_id, tag_id));
  `);

  const tagNames = ["classic", "dystopian", "sci-fi", "literary", "short-stories", "philosophy", "adventure", "romance"];
  const tagId: Record<string, number> = {};
  for (const name of tagNames) {
    const inserted = await pool.query<Tag>(
      "INSERT INTO tags (name) VALUES ($1) RETURNING id",
      [name]
    );
    // RETURNING id on a single-row INSERT always yields one row.
    const row = inserted.rows[0];
    if (row) tagId[name] = row.id;
  }

  const data = [
    ["George Orwell", 1903, [["Nineteen Eighty-Four", "dystopian", ["dystopian", "classic", "literary"]], ["Animal Farm", "fable", ["classic", "literary"]], ["Homage to Catalonia", "non-fiction", ["literary"]], ["Keep the Aspidistra", "literary", ["literary"]]]],
    ["Ursula K. Le Guin", 1929, [["The Left Hand of Darkness", "sci-fi", ["sci-fi", "classic"]], ["The Dispossessed", "sci-fi", ["sci-fi", "philosophy"]], ["A Wizard of Earthsea", "fantasy", ["adventure"]], ["The Ones Who Walk Away", "sci-fi", ["short-stories", "philosophy"]]]],
    ["Franz Kafka", 1883, [["The Trial", "literary", ["literary", "classic"]], ["The Metamorphosis", "literary", ["short-stories", "classic"]], ["The Castle", "literary", ["literary"]], ["In the Penal Colony", "short story", ["short-stories"]]]],
    ["Octavia Butler", 1947, [["Kindred", "sci-fi", ["sci-fi", "classic"]], ["Parable of the Sower", "sci-fi", ["sci-fi", "dystopian"]], ["Dawn", "sci-fi", ["sci-fi", "adventure"]], ["Bloodchild", "sci-fi", ["short-stories", "sci-fi"]]]],
    ["Fyodor Dostoevsky", 1821, [["Crime and Punishment", "literary", ["classic", "literary"]], ["The Brothers Karamazov", "literary", ["classic", "philosophy"]], ["The Idiot", "literary", ["classic", "literary"]], ["Notes from Underground", "literary", ["short-stories", "philosophy"]]]],
  ];

  let bookCount = 0;
  // The seed table is nested tuples, which infers as a wide union. Naming the
  // row shape is what lets the destructuring below be checked.
  type SeedBook = [title: string, genre: string, tags: string[]];
  type SeedAuthor = [name: string, birthYear: number, books: SeedBook[]];
  for (const [name, year, books] of data as SeedAuthor[]) {
    const authorRow = (
      await pool.query<Author>(
        "INSERT INTO authors (name, birth_year) VALUES ($1, $2) RETURNING id",
        [name, year]
      )
    ).rows[0];
    if (!authorRow) continue;
    const authorId = authorRow.id;
    for (const [title, genre, tags] of books) {
      const bookRow = (
        await pool.query<Book>(
          "INSERT INTO books (title, author_id, genre) VALUES ($1, $2, $3) RETURNING id",
          [title, authorId, genre]
        )
      ).rows[0];
      if (!bookRow) continue;
      const bookId = bookRow.id;
      for (const t of tags) await pool.query("INSERT INTO book_tags (book_id, tag_id) VALUES ($1, $2)", [bookId, tagId[t]]);
      bookCount += 1;
    }
  }
  console.log(`Seeded ${data.length} authors, ${bookCount} books, ${tagNames.length} tags.\n`);
}

export { pool, query, withQueryLog, setup, close };
export type { Author, Book, Tag };
