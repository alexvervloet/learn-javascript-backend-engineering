# Testing (Integration)

A production-style API test suite: Express + Zod + better-sqlite3, tested with
**Jest + supertest**. The companion to `learning/testing-concepts/` — that one
teaches the tools; this one applies them to a real Posts API.

The three core decisions in any DB-backed API test suite:

1. **Which database** — a real Postgres test DB is most faithful; here we use
   in-memory SQLite so the suite runs anywhere with no setup. (SQLite differs
   subtly from Postgres — fine for teaching, worth knowing in production.)
2. **Isolation** — each test runs inside a `SAVEPOINT` rolled back afterwards
   (`tests/helpers.ts`), so every test starts clean. Fast, no truncation.
3. **Sharing the connection** — supertest drives the in-process Express app,
   which imports the same `app/db.ts`, so the app and tests see the same data.

## Layout

| Path | What it is |
|---|---|
| `app/db.ts` | In-memory SQLite + schema |
| `app/schemas.ts` | Zod request schemas |
| `app/main.ts` | Express app: auth middleware, ownership checks, CRUD |
| `tests/helpers.ts` | Savepoint isolation + `makeUser`/`makePost` factories |
| `tests/auth.test.ts` | 401 (no/unknown user) and 403 (not owner) |
| `tests/posts.test.ts` | CRUD happy paths + response *and* DB-state assertions |
| `tests/validation.test.ts` | 422 for bad bodies; documents Zod's boundaries |

## Run

```bash
npm test                                                  # whole repo
npm test -- backends/learning/backend-concepts/testing       # this suite
```

