# Mocking

Backend code touches things that are slow, costly, or unreliable in tests:
databases, email, payment APIs, HTTP endpoints. **Mocking** replaces them with
controlled fakes for the duration of a test.

Core tools:
- **`jest.unstable_mockModule(path, factory)`** — replace a whole module. This is
  the ESM form. `jest.mock(path)` is the CommonJS one and does not work here:
  it relies on Jest hoisting the call above the `require`s, and ESM imports are
  already evaluated before any statement in the file can run.
- **`jest.fn<Signature>()`** — a standalone mock function that records calls.
  Give it the signature it stands in for, or it accepts any arguments and
  `mockResolvedValue` has nothing to check against.
- **`jest.spyOn(obj, "method")`** — wrap one real method on an existing object.

## The golden rule

Mock the module that the code under test **imports**. `checkout.ts` does
`import ... from "./services.js"`, so mocking `"./services.js"` swaps what it
sees. Because `unstable_mockModule` is not hoisted, it has to appear above an
`await import()` of the module under test — order is explicit rather than magic.

| File | What it teaches |
|---|---|
| `services.ts` | External deps (EmailService, PaymentService, WeatherClient) |
| `checkout.ts` | Business logic that uses those services |
| `01_mock_module.test.ts` | `jest.unstable_mockModule` + dynamic import (the ESM replacement for `jest.mock`), `mockImplementation`, fake timers |
| `02_mock_functions.test.ts` | `jest.fn`, `mockResolvedValue`, call matchers, `mock.calls` |
| `03_side_effects.test.ts` | `mockResolvedValueOnce` sequences, `mockRejectedValue`, `mockImplementation` |
| `04_spies_and_partial.test.ts` | `spyOn` interface safety at compile time, `mockRestore`, spying on real instances |

```bash
npm test -- backends/learning/testing-concepts/02-mocking
```
