# Testing (Jest)

Writing tests is as important as writing the code. A good suite lets you refactor
with confidence, catch regressions before they ship, and document behaviour in
executable form.

**Jest** is the testing framework for this repo (it already runs the backends and
d-structs-algos suites). This module covers the testing concepts a backend
engineer reaches for daily.

## What the sections cover

| Section | What it teaches |
|---|---|
| `01-jest-basics/` | `test`/`describe`, matchers, `toThrow`, `toBeCloseTo`, setup/teardown, `test.each`, skip/`test.failing` |
| `02-mocking/` | `jest.mock`, `jest.fn`, `mockResolvedValue`, `mockImplementation`, `jest.spyOn`, fake timers |
| `03-database-testing/` | SAVEPOINT rollback isolation, factory helpers, better-sqlite3 |
| `04-async-testing/` | async tests, `.resolves`/`.rejects`, async mocks, async DB with rollback |

## How to run

```bash
npm test                                          # whole repo
npm test -- backends/learning/testing-concepts                   # this module
npm test -- backends/learning/testing-concepts/02-mocking        # one section
npm test -- backends/learning/testing-concepts -t "slow"         # filter by test name
```

