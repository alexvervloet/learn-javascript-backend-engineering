# Jest Basics

Jest discovers `*.test.ts` files and runs each `test(...)` block. Assertions go
through the `expect(...)` API with matchers (`.toBe`, `.toEqual`, `.toThrow`, …),
which produce the rich diff output on failure.

| File | What it teaches |
|---|---|
| `01_basics.test.ts` | `test`/`describe`, `toBe` vs `toEqual`, `toThrow`, `toBeCloseTo` |
| `02_setup_teardown.test.ts` | `beforeEach`/`beforeAll` (the "fixture" replacement), factory functions, scope |
| `03_parametrize.test.ts` | `test.each` (array + tagged-template tables), nested for cartesian products |
| `04_marks.test.ts` | `test.skip`, conditional skip, `test.failing` (xfail), name-based filtering |

```bash
npm test -- backends/learning/testing-concepts/01-jest-basics
```
