# Web Security

The application-layer attacks a backend engineer is expected to have opinions
about. [../jwt-rbac/](../jwt-rbac/) covers who you are and what you may do; this
covers everything that goes wrong after that question is settled.

Every demo runs a real attack against real code, then the same attack against
the fixed version. The assertions live in `security.test.ts` and run in CI, so
the demos cannot quietly stop demonstrating anything.

| File | What it teaches |
|---|---|
| `01_security_headers.ts` | What helmet actually sets, header by header, and how to roll out a CSP without breaking the app |
| `02_injection.ts` | SQL injection against a live database; why parameters work and escaping does not |
| `03_xss.ts` | Reflected, stored and DOM XSS; escaping per context; CSP as the backstop |
| `04_csrf.ts` | Forging a request with someone else's cookies; SameSite and signed double-submit tokens |
| `security.test.ts` | The above, as assertions |

## The one idea underneath all of it

Injection bugs are all the same bug: **data crossed into a place where it was
read as code.** SQL injection is data becoming query syntax. XSS is data
becoming markup. Command injection is data becoming shell.

So the fix is always the same shape too. Not "clean the data" — you cannot
reliably clean data against a grammar you do not control — but "keep the data
and the code in separate channels so the boundary cannot move":

| Attack | The separate channel |
|---|---|
| SQL injection | Bound parameters; the statement is parsed before values arrive |
| XSS | Escaping at output, per context; or a template engine that does it |
| Command injection | `execFile(cmd, [args])`, never `exec(string)` |
| CSRF | A secret the other origin cannot read, not just one it cannot forge |

Whenever you find yourself writing a function called `sanitize`, check whether
what you actually want is a separate channel. Usually it is.

## What is worth your time first

If you do three things on an existing service, do these.

**1. Add helmet, and mean the CSP.** One line gets you eight headers. The CSP
is the one with real value and the one that takes work — deploy it in
`Report-Only` mode first, collect violations for a week, fix them, then enforce.
Setting `'unsafe-inline'` to make it pass is worse than having no CSP, because
it looks like a control and is not.

**2. Grep for string-built queries.** `$queryRawUnsafe`, `knex.raw`, any
template literal containing `SELECT`. Each one is either fine or a breach.

**3. Grep for unescaped output.** `dangerouslySetInnerHTML`, `| safe`,
`innerHTML =`, `res.send(` with interpolation. Same deal.

## What this module deliberately does not cover

- **Transport security.** TLS, certificate management, mTLS. Real, and it lives
  at the infrastructure layer rather than in application code.
- **Dependency supply chain.** `npm audit`, lockfile integrity, provenance. The
  CI module is the right place; a `npm audit --audit-level=high` step costs
  nothing and catches the easy cases.
- **Authentication itself.** Password hashing, token design, session
  revocation: [../jwt-rbac/](../jwt-rbac/) and the
  [bookmark-manager](../../../bookmark-manager/) capstone.
- **Rate limiting and abuse.** [../rate-limiting/](../rate-limiting/).
- **Secrets handling.** [../../docker-concepts/docker-security/](../../docker-concepts/docker-security/)
  covers build-time and image-level secrets, which is where they usually leak.

## Run

```bash
npm install                        # from the repo root (helmet, express, better-sqlite3)

npx tsx 01_security_headers.ts     # diffs bare vs helmet response headers, exits
npx tsx 02_injection.ts            # runs live SQLi against an in-memory database, exits
npx tsx 03_xss.ts                  # prints payloads escaped and unescaped, exits
npx tsx 04_csrf.ts                 # forges a request, then blocks it, exits

DEMO=serve npx tsx 03_xss.ts       # server on :8133 — try the payloads in a browser

npm test -- web-security           # the assertions
```

The `DEMO=serve` mode is worth the two minutes. It serves the same page three
ways — vulnerable, escaped, and unescaped-but-CSP-protected — so you can watch
a payload execute, then watch the browser refuse to run the identical payload
with a CSP in place. Seeing the console violation land is what makes the header
stop feeling like cargo cult.
