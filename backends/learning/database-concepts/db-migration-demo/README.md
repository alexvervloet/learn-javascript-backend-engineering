# Database Migration Demo

Hands-on migration practice with **Knex**: imperative migrations with explicit
`up()`/`down()` and a CLI to apply and roll back.

## Domain

A small library database — `authors` and `books` — that evolves through schema changes.

## What you'll learn

- Writing migration files with `up()` / `down()`
- `knex migrate:latest` / `knex migrate:rollback`
- Adding a column and backfilling existing rows (a data migration)
- Reading migration state with `knex migrate:status`

## Files

| File | Purpose |
|---|---|
| `knexfile.ts` | Knex config (SQLite via better-sqlite3) |
| `migrations/…create_authors_and_books.ts` | Initial schema |
| `migrations/…add_author_email.ts` | Add a column + backfill data |
| `seeds/initial.ts` | Sample data |
| `migrate_data.ts` | One-off SQLite → Postgres data transfer |

## Setup

```bash
npm install            # from the repo root (knex, better-sqlite3)
cd backends/learning/database-concepts/db-migration-demo

npx knex migrate:latest   # apply all pending migrations → library.db
npx knex seed:run         # populate sample data
```

## Common Knex commands

```bash
npx knex migrate:make add_isbn_to_books   # generate a new migration file
npx knex migrate:latest                   # apply all pending migrations
npx knex migrate:rollback                 # roll back the last batch
npx knex migrate:status                   # which migrations have run
```

