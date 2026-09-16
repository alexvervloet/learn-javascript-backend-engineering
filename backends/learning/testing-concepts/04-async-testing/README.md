# Async Testing

In Node, async is the default for I/O — and Jest handles it natively. Return the
promise (or use an `async` test body and `await`) and Jest waits for it. Nothing
extra to install; it's built in.

Key tools:
- `async`/`await` in the test body
- `.resolves` / `.rejects` matchers for promise-returning calls
- `Promise.all` for concurrent execution
- `jest.fn().mockResolvedValue` / `mockRejectedValue` for async dependencies

| File | What it teaches |
|---|---|
| `async_db.ts` | An async db interface (better-sqlite3 wrapped in promises) |
| `async_repository.ts` | Async repository (awaited queries), the async version of section 03 |
| `01_async_functions.test.ts` | Async tests, `.resolves`/`.rejects`, `Promise.all`, async mocks, try/finally cleanup |
| `02_async_db.test.ts` | Async repository queries + SAVEPOINT rollback isolation |

> The driver here is synchronous under the hood; the repository presents an
> async interface so the test patterns match what you'd write against a real
> async driver (pg, mysql2, libsql).

```bash
npm test -- backends/learning/testing-concepts/04-async-testing
```
