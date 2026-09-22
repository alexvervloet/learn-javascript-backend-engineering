# JWT & RBAC

JSON Web Tokens for stateless authentication, and role-based access control on
top, using [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) + Express.

| File | What it teaches |
|---|---|
| `01_jwt_basics.ts` | Anatomy of a JWT; sign/verify; tampered, expired, wrong-secret and `alg: none` rejection |
| `02_auth_flow.ts` | Login → token → `Authorization: Bearer`; auth middleware |
| `03_rbac.ts` | `requireRole(min)` middleware factory; 401 vs 403 |
| `04_refresh_tokens.ts` | Short access + long refresh tokens, rotation, server-side revocation, and why rotation alone is not theft detection |

## One rule worth carrying out of here

Every `jwt.verify` call in this folder passes `algorithms`. That list is the
server saying what it accepts; without it, the token's own `alg` header decides
how it gets verified, and a token is attacker-controlled input. That is the
algorithm-confusion family of attacks: `alg: "none"` leaves nothing to check,
and a server verifying RS256 can be handed an HS256 token signed with the public
key it was going to verify against. `jsonwebtoken` v9 blocks the `none` case on
its own, so this is about the habit, not about patching that one library.

`01_jwt_basics.ts` forges an `alg: none` token at the end so you can watch it
get rejected.

## Run

```bash
npm install                  # from the repo root (jsonwebtoken, express)

npx tsx 01_jwt_basics.ts     # prints and exits
npx tsx 02_auth_flow.ts      # server on :8000 — Ctrl-C to stop
npx tsx 03_rbac.ts           # server on :8000
npx tsx 04_refresh_tokens.ts # server on :8000
```

Only `01` runs to completion. The other three start an Express server on port
8000 and stay up until you stop them, so run one at a time and drive it with
`curl` from a second terminal.

```bash
curl -sX POST localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret"}'
curl localhost:8000/me -H 'Authorization: Bearer <token>'
```

