# OAuth2

Sign users in with a third-party provider (GitHub) via the Authorization Code
flow, using Express + express-session + the built-in `fetch`.

| File | What it teaches |
|---|---|
| `01_concepts.ts` | The flow mechanics: auth URL, `state` CSRF check, code→token exchange (printed, not run) |
| `02_github.ts` | Full GitHub login: session-stored state, token exchange, profile fetch, session cookie |
| `03_session.ts` | Bridge an OAuth identity to your own JWT — from then on, GitHub is out of the picture |

`01_concepts.ts` runs with no setup. For `02`/`03`, create a GitHub OAuth app
(callback `http://localhost:8000/auth/github/callback`) and supply
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `SECRET_KEY` (see `.env.example`).

## Run

```bash
npm install                 # from the repo root (express, express-session, jsonwebtoken)
npx tsx 01_concepts.ts         # prints and exits
npx tsx 02_github.ts           # server on :8000 — open http://localhost:8000
npx tsx 03_session.ts          # server on :8000 — the OAuth2 to JWT bridge
```

`02` and `03` both bind port 8000, so run one at a time.

