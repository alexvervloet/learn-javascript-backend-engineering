# Database Testing

The central challenge of testing database code is **isolation**: each test must
start from a clean slate so tests run in any order without interfering.

The naive approach (`DELETE FROM ...` or recreating the schema) is slow. The
standard approach is **transaction rollback** — here, SQLite SAVEPOINTs:

```js
beforeEach(() => db.exec("SAVEPOINT test"));
afterEach(() => db.exec("ROLLBACK TO test")); // undoes every write, no DDL
```

This uses **better-sqlite3** (synchronous, in-memory) so it runs standalone with
no Docker. The same pattern applies to Postgres via your client's
transaction/savepoint API.

| File | What it teaches |
|---|---|
| `db.ts` | In-memory schema + connection |
| `repository.ts` | Data access layer — the code under test |
| `factories.ts` | Factory helpers for building test rows |
| `01_isolation.test.ts` | Proving test data doesn't bleed between tests |
| `02_factories.test.ts` | Building realistic data with overridable defaults; cascade delete |

```bash
npm test -- backends/learning/testing-concepts/03-database-testing
```
